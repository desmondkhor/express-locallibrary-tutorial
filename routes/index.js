var author_photo = require('../models/author_photo');
var book_photo = require('../models/book_photo');
var fs = require('fs');
var express = require('express');
var debug = require('debug')('index');

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  // res.render('index', { title: 'Express' });
  //console.log(" *** index");
  debug(' *** env: ' + res.app.get('env'));
  author_photo.find()
  .exec(function (err, list_author_photos) {
    if (err) { return next(err); }
    //console.log(list_author_photos)
    for (let i = 0; i < list_author_photos.length; i++) {
      //console.log(list_author_photos[i].image_data.data.length);
      try {
        fs.writeFileSync(list_author_photos[i].path, list_author_photos[i].image_data.data);
        debug('photo of '+list_author_photos[i].caption+' written to ' + list_author_photos[i].path);
      } catch(e) {
        debug(e);
      }
    }
  });

  book_photo.find()
  .exec(function (err, list_book_photos) {
    if (err) { return next(err); }
    //console.log(list_book_photos)
    for (let i = 0; i < list_book_photos.length; i++) {
      //console.log(list_book_photos[i].image_data.data.length);
      try {
        fs.writeFileSync(list_book_photos[i].path, list_book_photos[i].image_data.data);
        debug('photo of '+list_book_photos[i].caption+' written to ' + list_book_photos[i].path);
      } catch(e) {
        debug(e);
      }
    }
  });

  res.redirect('/catalog');
});

module.exports = router;