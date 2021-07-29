import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
puppeteer.use(StealthPlugin())

/**
 * @typedef {Function} LogFunction
 * @property {string} toLog
 */

/**
 * @param {string} facebookLogin
 * @param {string} facebookPassword
 * @param {boolean} show
 * @param {LogFunction} sendLog
 * @param {string|null} proxy
 *
 * @returns {Promise<import('puppeteer').Page>}
 */
export default function login(
    facebookLogin,
    facebookPassword,
    show = false,
    sendLog = (toLog) => {},
    proxy = null
) {
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
                        console.log('logged in !')
                        resolve(loggedInPage)
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
            return pages[i]
        }
    }
    return null;
}
