const puppeteer = require('puppeteer')

/**
 * @param {string} facebookLogin
 * @param {string} facebookPassword
 * @param {boolean} headless
 * 
 * @returns {Promise}
 */
function post(facebookLogin, facebookPassword, headless = true) {
    return new Promise(async () => {
        const browser = await puppeteer.launch({ headless: headless })
        const page = await browser.newPage()
        await page.goto('https://www.tiktok.com/login')

        const facebookButtonSelector = '.channel-item-wrapper-2gBWB:nth-of-type(2)>.channel-name-2qzLW'
        await page.waitForSelector(facebookButtonSelector)
        
        let hasLoggedIn = false
        await browser.on('targetcreated', async () => {
            /** @type {import('puppeteer').Page} foundFacebookLogin */
            const facebookLoginPage = await findFacebookLogin(browser);
            if (facebookLoginPage) {

                await facebookLoginPage.reload()
                await facebookLoginPage.evaluate((facebookLogin, facebookPassword) => {
                    const body = document.body
                    body.querySelector('#email').value = facebookLogin
                    body.querySelector('#pass').value = facebookPassword
                    body.querySelector('input[name="login"]').click()
                }, facebookLogin, facebookPassword)
            } else {
                /** @type {import('puppeteer').Page} loggedInPage */
                const loggedInPage = await findLoggedInPage(browser);
                if (loggedInPage) {
                    if (! hasLoggedIn) {
                        hasLoggedIn = true
                        
                        await page.goto('https://www.tiktok.com/upload/?lang=en')
                    }
                }
            }
        })

        await page.click(facebookButtonSelector)

        //browser.close()
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

module.exports = post