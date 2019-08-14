const validator = require('express-validator');
var async = require('async');
var Book = require('../models/book');
var Genre = require('../models/genre');
var debug = require('debug')('genre');

// Display list of all Genre.
exports.genre_list = function(req, res) {
    // res.send('NOT IMPLEMENTED: Genre list');
    Genre.find()
    .sort([['name', 'ascending']])
    .exec(function (err, list_genres) {
      if (err) { return next(err); }
      //Successful, so render
      res.render('genre_list', { title: 'Genre List', genre_list: list_genres });
    });
};

// Display detail page for a specific Genre.
exports.genre_detail = function(req, res, next) {
    async.parallel({
        genre: function(callback) {
            Genre.findById(req.params.id)
              .exec(callback);
        },

        genre_books: function(callback) {
            Book.find({ 'genre': req.params.id })
              .populate('author')
              .exec(callback);
        },

    }, function(err, results) {
        if (err) { return next(err); }
        if (results.genre==null) { // No results.
            var err = new Error('Genre not found');
            err.status = 404;
            return next(err);
        }
        // Successful, so render
        res.render('genre_detail', { title: 'Genre Detail', genre: results.genre, genre_books: results.genre_books } );
    });
};

// Display Genre create form on GET.
exports.genre_create_get = function(req, res) {
    res.render('genre_form', {title: 'Create Genre'});
};

// Handle Genre create on POST.
exports.genre_create_post = [

    // Validate that the name field is not empty.
    validator.body('name', 'Genre name required').isLength({ min: 1 }).trim(),

    // Sanitize (escape) the name field.
    validator.sanitizeBody('name').escape(),

    // Process request after validation and sanitization.
    (req, res, next) => {

      // Extract the validation errors from a request.
      const errors = validator.validationResult(req);

      // Create a genre object with escaped and trimmed data.
      var genre = new Genre(
        { name: req.body.name }
      );

      if (!errors.isEmpty()) {
        // There are errors. Render the form again with sanitized values/error messages.
        res.render('genre_form', { title: 'Create Genre', genre: genre, errors: errors.array()});
        return;
      }
      else {
        // Data from form is valid.
        // Check if Genre with same name already exists.
        Genre.findOne({ 'name': req.body.name })
        .exec( function(err, found_genre) {
          if (err) { return next(err); }

          if (found_genre) {
            // Genre exists, redirect to its detail page.
            res.redirect(found_genre.url);
          }
          else {

            genre.save(function (err) {
              if (err) { return next(err); }
              // Genre saved. Redirect to genre detail page.
              //res.redirect(genre.url);
              Genre.find()
              .sort([['name', 'ascending']])
              .exec(function (err, list_genres) {
                if (err) { return next(err); }
                //Successful, so render
                res.render('genre_list', { title: 'Genre List', genre_list: list_genres });
              });
            });
          }
        });
      }
    }
  ];

// Display Genre delete form on GET.
exports.genre_delete_get = function(req, res) {

  async.parallel({
    genre: function(callback) {
        Genre.findById(req.params.id).exec(callback)
    },
    genre_books: function(callback) {
      Book.find({ 'genre': req.params.id }).exec(callback)
    },
  }, function(err, results) {
      if (err) { return next(err); }
      if (results.genre==null) { // No results.
          res.redirect('/catalog/genres');
      }
      // Successful, so render.
      res.render('genre_delete', { title: 'Delete Genre', genre: results.genre, genre_books: results.genre_books } );
  });
};

// Handle Genre delete on POST.
exports.genre_delete_post = function(req, res) {

  async.parallel({
    genre: function(callback) {
      Genre.findById(req.body.genreid).exec(callback)
    },
    genre_books: function(callback) {
      Book.find({ 'genre': req.body.genreid }).exec(callback)
    },
  }, function(err, results) {
      if (err) { return next(err); }
      // Success
      if (results.genre_books.length > 0) {
          // Books are of various genre. Render in same way as for GET route.
          res.render('genre_delete', { title: 'Delete Genre', genre: results.genre, genre_books: results.genre_books } );
          return;
      }
      else {
          // No book with this genre. Delete object and redirect to the list of genres.
          Genre.findByIdAndRemove(req.body.genreid, function deleteGenre(err) {
              if (err) { return next(err); }
              // Success - go to genre list
              res.redirect('/catalog/genres')
          })
      }
  });
};

// Display Genre update form on GET.
exports.genre_update_get = function(req, res) {

    // Get genre for form.
    async.parallel({
      genre: function(callback) {
          Genre.findById(req.params.id).exec(callback);
      }
  }, function(err, results) {
      if (err) { return next(err); }
      if (results.genre==null) { // No results.
          var err = new Error('Genre not found');
          err.status = 404;
          return next(err);
      }
      // Success.
      res.render('genre_form', { title: 'Update Genre', genre:results.genre });
  });
};

// Handle Genre update on POST.
exports.genre_update_post = [

  // Validate fields.
  validator.body('name', 'Genre name must be specified').isLength({ min: 1 }).trim(),

  // Sanitize fields.
  validator.sanitizeBody('name').escape(),

  // Process request after validation and sanitization.
  (req, res, next) => {

      // Extract the validation errors from a request.
      const errors = validator.validationResult(req);

      // Create a Genre object with escaped/trimmed data and old id.
      var genre = new Genre(
        { name: req.body.name,
          _id:req.params.id //This is required, or a new ID will be assigned!
         });

      if (!errors.isEmpty()) {
          // There are errors so render the form again, passing sanitized values and errors.
          Genre.find({})
              .exec(function (err, genres) {
                  if (err) { return next(err); }
                  // Successful, so render.
                  res.render('genre_form', { title: 'Update Genre', errors: errors.array(), genre:genre });
          });
          return;
      }
      else {
        // Data from form is valid.
        Genre.findByIdAndUpdate(req.params.id, genre, {}, function (err,thegenre) {
          if (err) { return next(err); }
            // Successful - redirect to detail page.
            res.redirect(thegenre.url);
          }
        );
      }
  }
];
