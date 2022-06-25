import websockets from "./websockets";
const express = require('express');
const logger = require('morgan');
const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(function (req: { testing: string; }, res: any, next: () => any) {
    req.testing = 'testing';
    return next();
});

app.get('/', function(req: any, res: { end: () => void; }){
    res.end();
});


const port = process.env.PORT || 3000;
const server = app.listen(port);
console.log(`Running on port ${port}`)
websockets(server);
