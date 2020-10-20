# tiktok-poster

Installation :
```
npm install pierreminiggio/tiktok-poster
```

Utilisation : 
```javascript
const post = require('@pierreminiggio/tiktok-poster')
post(login, password, video, legend, show).then(() => {
    // done
}).catch((err) => {
    console.log(err) // 'timed out' 
})
```
