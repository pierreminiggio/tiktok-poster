const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

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
 * @param {string|null} proxy
 * 
 * @returns {Promise<string>}
 */
function post(
    facebookLogin,
    facebookPassword,
    videoPath,
    legend,
    show = false,
    sendLog = (toLog) => {},
    proxy = null
) {
    const hasDebugFunction = ! isFunctionEmpty(sendLog)
    return new Promise(async (resolve, rejects) => {
        sendLog('Launch !')

        const args = [
            '--window-size=1000,800',
            '--no-sandbox'
        ]

        if (proxy !== null) {
            sendLog('Using proxy ' + proxy)
            args.push('--proxy-server=' + proxy)
        }
 
        const browser = await puppeteer.launch({
            headless: ! show,
            args
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
        await page.evaluateOnNewDocument(() => {
            delete navigator.__proto__.webdriver;
        });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36 OPR/77.0.4054.60');
        await page.goto('https://www.tiktok.com/login')

        sendLog('Waiting for Fb Login selector...')

        const facebookButtonSelector = '.channel-item-wrapper-2gBWB+.channel-item-wrapper-2gBWB+.channel-item-wrapper-2gBWB .channel-name-2qzLW'
        await page.waitForSelector(facebookButtonSelector)

        sendLog('Waited !')
        
        let hasLoggedIn = false
        await browser.on('targetcreated', async () => {
            sendLog('Target created')
            /** @type {import('puppeteer').Page} foundFacebookLogin */
            const facebookLoginPage = await findFacebookLogin(browser, sendLog);
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
                const loggedInPage = await findLoggedInPage(browser, sendLog);
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

                        await page.waitForTimeout(3000)

                        sendLog('Checking if Cookies showed up...')

                        const cookiesButtonSelector = 'a[href^="https://www.tiktok.com/legal/cookie-settings"]+button'
                        const hasCookiesPopupShownUp = await page.evaluate(cookiesButtonSelector => {
                            return document.querySelector(cookiesButtonSelector) !== null
                        }, cookiesButtonSelector)

                        if (hasCookiesPopupShownUp) {
                            sendLog('They showed up !')
                            await page.click(cookiesButtonSelector)
                            sendLog('Accepted Cookies !')
                        }

                        sendLog('Waiting for post button...')
                        const postButtonSelector = 'button[type="button"]:nth-of-type(2)'
                        await page.waitForSelector(postButtonSelector)
                        sendLog('Waited ! Clicking post button...')
                        if (hasDebugFunction) {
                            await page.screenshot({path: '1before-clicking.png'})
                        }


                        await page.click(postButtonSelector)
                        sendLog('Clicked !')
                        if (hasDebugFunction) {
                            await page.screenshot({path: '2after-clicking.png'})
                        }


                        await page.waitForTimeout(3000)
                        await page.waitForTimeout(10000)
                        if (hasDebugFunction) {
                            await page.screenshot({path: '3after-clicking-after-wait.png'})
                        }


                        const goToProfileButton = '.modal-btn+.modal-btn'
                        try {
                            await page.waitForSelector(goToProfileButton)
                        } catch (error) {
                            if (hasDebugFunction) {
                                await page.screenshot({path: '7fail.png'})
                            }

                            sendLog(await page.evaluate(() => document.head.outerHTML + document.body.outerHTML))
                            await browser.close()
                            rejects('Profile button not found after posting : ' + error.message)

                            return
                        }

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
                    }
                }
            }
        })

        sendLog('Clicking Fb Login button !')
        await page.click(facebookButtonSelector)
        sendLog('Fb Login button clicked !')
    })
}

/**
 * @param {import('puppeteer').Browser} browser
 * @param {LogFunction} sendLog
 * 
 * @returns {?import('puppeteer').Page}
 */
async function findFacebookLogin(browser, sendLog) {
    return await findPageIncludes(browser, 'facebook.com/login.php', sendLog)
}

/**
 * @param {import('puppeteer').Browser} browser
 * @param {LogFunction} sendLog
 * 
 * @returns {?import('puppeteer').Page}
 */
async function findLoggedInPage(browser, sendLog) {
    return await findPageIncludes(
        browser,
        'https://www.tiktok.com/foryou?loginType=facebook&lang=en',
        sendLog
    ) || await findPageIncludes(
        browser,
        'https://www.tiktok.com/foryou?lang=en',
        sendLog
    ) || await findPageIncludes(
        browser,
        'https://www.tiktok.com/foryou?loginType=facebook&lang=fr',
        sendLog
    ) || await findPageIncludes(
        browser,
        'https://www.tiktok.com/foryou?lang=fr',
        sendLog
    )
}

/**
 * @param {import('puppeteer').Browser} browser 
 * @param {string} pageTitleIncludedText
 * @param {LogFunction} sendLog
 * 
 * @returns {?import('puppeteer').Page}
 */
async function findPageIncludes(browser, pageTitleIncludedText, sendLog) {
    let pages = await browser.pages()
    for (let i = 0; i < pages.length; i += 1) {
        const pageUrl = pages[i].url()
        sendLog(pageUrl)
        if (pageUrl.includes(pageTitleIncludedText)) {
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

/**
 * @param {Function} f
 * @returns {boolean}
 */
function isFunctionEmpty(f) {
    return f.toString() === '(toLog) => {}'
}

module.exports = post