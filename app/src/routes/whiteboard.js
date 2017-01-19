var express = require('express');
var router = express.Router();

/* GET home page. */

function whiteboard(req, res, next) {
  res.render('whiteboard', {
    title: 'WeOutline, a shared whiteboard, designed to work among teams'
  });
}

router.get('/wb/:id', whiteboard);
router.get('/wb', whiteboard);
router.get('/', whiteboard);


module.exports = router;