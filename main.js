const puppeteer = require('puppeteer')

/**
 * @typedef {Function} LogFunction
 * @property {string} toLog
 */

/**
 * @param {string} facebookLogin
 * @param {string} facebookPassword
 * @param {string} videoPath
 * @param {string} legend
 * @param {boolean} show
 * @param {LogFunction} sendLog
 * 
 * @returns {Promise<string>}
 */
function post(
    facebookLogin,
    facebookPassword,
    videoPath,
    legend,
    show = false,
    sendLog = (loLog) => {}
) {
    return new Promise(async (resolve, rejects) => {
        sendLog('Launch !')
        const browser = await puppeteer.launch({
            headless: ! show,
            args: [
                '--window-size=800,500',
                //'--window-position=0,-600'
            ]
        })
        sendLog('Launched')
        let posterTimeout = true
        setTimeout(async () => {
            if (posterTimeout) {
                await browser.close()
                sendLog('Timed out')
                rejects('timed out')
            }
        }, 30000)

        sendLog('Go to login page')
        const page = await browser.newPage()
        await page.goto('https://www.tiktok.com/login')
        sendLog('Waiting for Fb Login selector...')

        const facebookButtonSelector = '.channel-item-wrapper-2gBWB+.channel-item-wrapper-2gBWB+.channel-item-wrapper-2gBWB .channel-name-2qzLW'
        await page.waitForSelector(facebookButtonSelector)

        sendLog('Waited !')
        
        let hasLoggedIn = false
        await browser.on('targetcreated', async () => {
            sendLog('Target created')
            /** @type {import('puppeteer').Page} foundFacebookLogin */
            const facebookLoginPage = await findFacebookLogin(browser);
            sendLog('Fb login page found ? ' + (facebookLoginPage ? 'yes' : 'no'))
            if (facebookLoginPage) {
                sendLog('Fb login page reloading...')
                await facebookLoginPage.reload()
                sendLog('Fb login page reloaded. Loggin-in ...')
                try {
                    await facebookLoginPage.evaluate((facebookLogin, facebookPassword) => {
                        const body = document.body
                        body.querySelector('#email').value = facebookLogin
                        body.querySelector('#pass').value = facebookPassword
                        body.querySelector('input[name="login"]').click()
                    }, facebookLogin, facebookPassword)
                } catch (loginError) {
                    await browser.close()
                    rejects('Facebook Login Failed')

                    return
                }

                sendLog('Likely logged in !')
            } else {
                /** @type {import('puppeteer').Page} loggedInPage */
                const loggedInPage = await findLoggedInPage(browser);
                sendLog('TikTok page found ? ' + (loggedInPage ? 'yes' : 'no'))
                if (loggedInPage) {
                    if (! hasLoggedIn) {
                        hasLoggedIn = true
                        posterTimeout = false
                        sendLog('Goto upload page...')
                        await page.goto('https://www.tiktok.com/upload/?lang=en')

                        sendLog('Went ! Waiting for selector...')
                        const videoInputSelector = 'input[name="upload-btn"]'
                        await page.waitForSelector(videoInputSelector)
                        const inputFile = await page.$(videoInputSelector)
                        sendLog('Waited ! Uploading file...')
                        await inputFile.uploadFile(videoPath)
                        
                        sendLog('Uploaded ! Waiting for legends input...')
                        const legendInputSelector = '.DraftEditor-editorContainer>div'
                        await page.waitForSelector(legendInputSelector)
                        sendLog('Waited ! focusing input...')
                        await page.evaluate((legendInputSelector) => {
                            document.body.querySelector(legendInputSelector).focus()
                        }, legendInputSelector)

                        sendLog('Focused ! Typing legend...')
                        await asyncForEach(Array.from(legend), async (char) => {
                            await sleep(1000)
                            await page.type(legendInputSelector, char)
                        })

                        await page.type(legendInputSelector, ' ')
                        sendLog('Typed !')

                        setTimeout(async () => {
                            sendLog('Waiting for post button...')
                            const postButtonSelector = 'button[type="button"]:nth-of-type(2)'
                            await page.waitForSelector(postButtonSelector)
                            sendLog('Waited ! Clicking post button...')
                            
                            await page.click(postButtonSelector)
                            sendLog('Clicked !')
                            setTimeout(async () => {
                                await page.waitForTimeout(10000)
                                const goToProfileButton = '.modal-btn+.modal-btn'
                                await page.waitForSelector(goToProfileButton)
                                await page.click(goToProfileButton)

                                const lastVideoSelector = '.video-feed-item-wrapper'
                                await page.waitForSelector(lastVideoSelector)
                                const tiktokUrl = await page.evaluate(lastVideoSelector => {
                                    return document.querySelector(lastVideoSelector)?.href
                                }, lastVideoSelector)
                                sendLog(tiktokUrl)

                                sendLog('Likely Posted !')
                                await browser.close()
                                resolve(tiktokUrl)
                            }, 3000)
                        }, 3000)
                    }
                }
            }
        })

        await page.click(facebookButtonSelector)
    })
}

/**
 * @param {import('puppeteer').Browser} browser 
 * 
 * @returns {?import('puppeteer').Page}
 */
async function findFacebookLogin(browser) {
    return await findPageIncludes(browser, 'facebook.com/login.php')
}

/**
 * @param {import('puppeteer').Browser} browser 
 * 
 * @returns {?import('puppeteer').Page}
 */
async function findLoggedInPage(browser) {
    return await findPageIncludes(
        browser,
        'https://www.tiktok.com/foryou?loginType=facebook&lang=en'
    ) || await findPageIncludes(
        browser,
        'https://www.tiktok.com/foryou?lang=en'
    )
}

/**
 * @param {import('puppeteer').Browser} browser 
 * @param {string} pageTitleIncludedText
 * 
 * @returns {?import('puppeteer').Page}
 */
async function findPageIncludes(browser, pageTitleIncludedText) {
    let pages = await browser.pages()
    for (let i = 0; i < pages.length; i += 1) {
        if (pages[i].url().includes(pageTitleIncludedText)) {
            module.exports.page = pages[i] // Set the new working page as the popup
            return pages[i]
        }
    }
    return null;
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

/**
 * @param {number} ms 
 */
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

module.exports = post