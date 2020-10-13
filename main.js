const puppeteer = require('puppeteer')

/**
 * @param {string} facebookLogin
 * @param {string} facebookPassword
 * @param {string} videoPath
 * @param {string} legend
 * @param {boolean} headless
 * 
 * @returns {Promise}
 */
function post(facebookLogin, facebookPassword, videoPath, legend, headless = true) {
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
                        const videoInputSelector = 'input[name="upload-btn"]'
                        await page.waitForSelector(videoInputSelector)
                        const inputFile = await page.$(videoInputSelector)
                        await inputFile.uploadFile(videoPath)
                        
                        const legendInputSelector = '.DraftEditor-editorContainer>div'
                        await page.waitForSelector(legendInputSelector)
                        await page.evaluate((legendInputSelector) => {
                            document.body.querySelector(legendInputSelector).focus()
                        }, legendInputSelector)

                        await asyncForEach(Array.from(legend), async (char) => {
                            await sleep(1000)
                            await page.type(legendInputSelector, char)
                        })

                        await page.type(legendInputSelector, ' ')

                        setTimeout(async () => {
                            const postButtonSelector = 'button[type="button"]:nth-of-type(2)'
                            await page.waitForSelector(postButtonSelector)
                            
                            await page.click(postButtonSelector)
                            setTimeout(() => {
                                browser.close()
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