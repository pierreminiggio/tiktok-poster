import isFunctionEmpty from './isFunctionEmpty.js'
import login from './login.js'
import asyncForEach from '@pierreminiggio/async-foreach'

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
export default function post(
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

        let page
        try {
            page = await login(
                facebookLogin,
                facebookPassword,
                show,
                sendLog,
                proxy
            )
        } catch (loginError) {
            rejects(loginError)

            return
        }

        const browser = page.browser()

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
            await page.waitForTimeout(1000)
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
    })
}
