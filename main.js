import isFunctionEmpty from './isFunctionEmpty.js'
import asyncForEach from '@pierreminiggio/async-foreach'
import login from '@pierreminiggio/tiktok-login'

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

        sendLog('Went ! Waiting for Iframe...')
        const iframeElement = await page.waitForSelector('iframe[src="https://www.tiktok.com/creator#/upload/?lang=en"]')
        sendLog('Waited')
        const frame = await iframeElement.contentFrame()

        sendLog('Loaded ! Waiting for file input selector...')
        const videoInputSelector = 'input[type="file"]'
        const inputFile = await frame.waitForSelector(videoInputSelector)
        sendLog('Waited ! Uploading file...')
        await inputFile.uploadFile(videoPath)

        const videoFileNameSelector = '.file-text'

        let doneUploading = false

        const secondsWaitedBeforeAssumingItsUploaded = 20

        const videoUploadTimeout = setTimeout(async () => {
            sendLog('Waited ' + secondsWaitedBeforeAssumingItsUploaded + ' seconds, we assume it\'s now uploaded !')
            doneUploading = true
        }, secondsWaitedBeforeAssumingItsUploaded * 1000)

        do {
            const hasFinishedUploading = await frame.evaluate(videoFileNameSelector => {
                return !!(document.querySelector(videoFileNameSelector)?.innerText)
            }, videoFileNameSelector)

            if (hasFinishedUploading) {
                doneUploading = true
            }

            sendLog('File ' + (doneUploading ? 'uploaded !' : 'uploading...'))

            await frame.waitForTimeout(1000)
        } while (! doneUploading)

        clearTimeout(videoUploadTimeout)

        sendLog('Uploaded ! Waiting for legends input...')

        const legendInputSelector = '.DraftEditor-editorContainer>div'

        await frame.waitForSelector(legendInputSelector)

        sendLog('Waited !')

        const currentLegendContent = await frame.evaluate(legendInputSelector => {
            return document.querySelector(legendInputSelector)?.innerText
        }, legendInputSelector)

        sendLog('Current legend : ' + currentLegendContent)

        const currentLegendLength = currentLegendContent.length || 0

        sendLog('Focusing input...')
        await frame.focus(legendInputSelector)

        sendLog('Focused !')

        sendLog('Erasing ' + currentLegendLength + ' chars...')

        await page.keyboard.press('End');

        for (let letter = 0; letter < currentLegendLength; letter++) {
            await page.keyboard.press('Backspace', {delay: 300});
        }

        sendLog('Erased !')

        sendLog('Typing legend...')

        await asyncForEach(Array.from(legend), async (char) => {
            await frame.waitForTimeout(1000)
            await frame.type(legendInputSelector, char)
        })

        await frame.type(legendInputSelector, ' ')
        sendLog('Typed !')

        await frame.waitForTimeout(3000)

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
        const postButtonSelector = '.btn-post'
        await frame.waitForSelector(postButtonSelector)
        sendLog('Waited ! Clicking post button...')
        if (hasDebugFunction) {
            await page.screenshot({path: '1before-clicking.png'})
        }

        await frame.click(postButtonSelector)
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
            await frame.waitForSelector(goToProfileButton)
        } catch (error) {
            if (hasDebugFunction) {
                await page.screenshot({path: '7fail.png'})
            }

            sendLog(await frame.evaluate(() => document.head.outerHTML + document.body.outerHTML))
            await browser.close()
            rejects('Profile button not found after posting : ' + error.message)

            return
        }

        await frame.click(goToProfileButton)

        const lastVideoSelector = '[data-e2e="user-post-item"] a'
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
