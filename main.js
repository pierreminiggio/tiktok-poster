const puppeteer = require('puppeteer')

/**
 * @param {string} facebookLogin
 * @param {string} facebookPassword
 * @param {string} videoPath
 * @param {string} legend
 * @param {boolean} show
 * 
 * @returns {Promise}
 */
function post(facebookLogin, facebookPassword, videoPath, legend, show = true) {
    return new Promise(async (resolve, rejects) => {
        console.log('Launch !')
        const browser = await puppeteer.launch({
            headless: ! show,
            args: [
                '--window-size=800,500',
                //'--window-position=0,-600'
            ]
        })
        console.log('Launched')
        let posterTimeout = true
        setTimeout(() => {
            if (posterTimeout) {
                browser.close()
                console.log('Timed out')
                rejects('timed out')
            }
        }, 30000)

        console.log('Go to login page')
        const page = await browser.newPage()
        await page.goto('https://www.tiktok.com/login')
        console.log('Waiting for Fb Login selector...')

        const facebookButtonSelector = '.channel-item-wrapper-2gBWB:nth-of-type(2)>.channel-name-2qzLW'
        await page.waitForSelector(facebookButtonSelector)

        console.log('Waited !')
        
        let hasLoggedIn = false
        await browser.on('targetcreated', async () => {
            console.log('Target created')
            /** @type {import('puppeteer').Page} foundFacebookLogin */
            const facebookLoginPage = await findFacebookLogin(browser);
            console.log('Fb login page found ? ' + (facebookLoginPage ? 'yes' : 'no'))
            if (facebookLoginPage) {
                console.log('Fb login page reloading...')
                await facebookLoginPage.reload()
                console.log('Fb login page reloaded. Loggin-in ...')
                await facebookLoginPage.evaluate((facebookLogin, facebookPassword) => {
                    const body = document.body
                    body.querySelector('#email').value = facebookLogin
                    body.querySelector('#pass').value = facebookPassword
                    body.querySelector('input[name="login"]').click()
                }, facebookLogin, facebookPassword)
                console.log('Likely logged in !')
            } else {
                /** @type {import('puppeteer').Page} loggedInPage */
                const loggedInPage = await findLoggedInPage(browser);
                console.log('TikTok page found ? ' + (loggedInPage ? 'yes' : 'no'))
                if (loggedInPage) {
                    if (! hasLoggedIn) {
                        hasLoggedIn = true
                        posterTimeout = false
                        console.log('Goto upload page...')
                        await page.goto('https://www.tiktok.com/upload/?lang=en')

                        console.log('Went ! Waiting for selector...')
                        const videoInputSelector = 'input[name="upload-btn"]'
                        await page.waitForSelector(videoInputSelector)
                        const inputFile = await page.$(videoInputSelector)
                        console.log('Waited ! Uploading file...')
                        await inputFile.uploadFile(videoPath)
                        
                        console.log('Uploaded ! Waiting for legends input...')
                        const legendInputSelector = '.DraftEditor-editorContainer>div'
                        await page.waitForSelector(legendInputSelector)
                        console.log('Waited ! focusing input...')
                        await page.evaluate((legendInputSelector) => {
                            document.body.querySelector(legendInputSelector).focus()
                        }, legendInputSelector)

                        console.log('Focused ! Typing legend...')
                        await asyncForEach(Array.from(legend), async (char) => {
                            await sleep(1000)
                            await page.type(legendInputSelector, char)
                        })

                        await page.type(legendInputSelector, ' ')
                        console.log('Typed !')

                        setTimeout(async () => {
                            console.log('Waiting for post button...')
                            const postButtonSelector = 'button[type="button"]:nth-of-type(2)'
                            await page.waitForSelector(postButtonSelector)
                            console.log('Waited ! Clicking post button...')
                            
                            await page.click(postButtonSelector)
                            console.log('Clicked !')
                            setTimeout(() => {
                                browser.close()
                                console.log('Likely Posted !')
                                resolve()
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
    return await findPageIncludes(browser, 'https://www.tiktok.com/foryou?loginType=facebook&lang=en')
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