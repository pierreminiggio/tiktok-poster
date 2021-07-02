const post = require('./main.js')
const fs = require('fs');
fs.readFile('./ids.json', 'utf-8', (err, data) => {
    ids = JSON.parse(data)
    post(
        ids.login,
        ids.password,
        __dirname + '/test.mp4',
        'Ceci est un test',
        false,
        (toLog) => {},
        null
    ).then(console.log)
})