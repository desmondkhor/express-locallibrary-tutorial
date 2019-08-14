const validator = require('express-validator');
//const { body,validationResult } = require('express-validator/check');
//const { sanitizeBody } = require('express-validator/filter');
var async = require('async');
var Book = require('../models/book');
var Author = require('../models/author');
var fs = require('fs');
var multer = require('multer');
//const morgan = require('morgan');
var path = require('path');
var Photo = require('../models/author_photo');
var debug = require('debug')('author');

var storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, './public/uploads');
  },
  filename: function(req, file, cb) {
      cb(null, file.originalname);
  }
});

var upload = multer({
    storage: storage,
    limits: { fileSize:200000 },
    fileFilter: function(req, file, callback){
        validateFile(file, callback);
    }}).fields([
    {name: 'author_image_file'}
]);

var validateFile = function(file, cb ) {
    allowedFileTypes = /jpeg|jpg|png|gif/;
    const extension = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType  = allowedFileTypes.test(file.mimetype);
    if(extension && mimeType) {
        return cb(null, true);
    } else {
        cb("Invalid file type. Only JPEG, PNG and GIF file are allowed.")
    }
}

//Display list of all authors
exports.author_list = function(req, res) {

    debug(' *** list all authors ***');
    Author.find()
    .sort([['family_name', 'ascending']])
    .exec(function (err, list_authors) {
      if (err) { return next(err); }
      //Successful, so render
      res.render('author_list', { title: 'Author List', author_list: list_authors });
    });
};

//Display detail page for a specific Author
exports.author_detail = function(req, res, next) {
    async.parallel({
        author: function(callback) {
            Author.findById(req.params.id)
              .exec(callback)
        },
        authors_books: function(callback) {
          Book.find({ 'author': req.params.id },'title summary')
          .exec(callback)
        },
    }, function(err, results) {
        if (err) { return next(err); } // Error in API usage.
        if (results.author==null) { // No results.
            var err = new Error('Author not found');
            err.status = 404;
            return next(err);
        }
        // Successful, so render.
        res.render('author_detail', { title: 'Author Detail', author: results.author, author_books: results.authors_books } );
    });
};

//Display author create form on GET
exports.author_create_get = function(req, res) {
    res.render('author_form', { title: 'Create Author'});
};

//Handle author create on POST
exports.author_create_post = [

    // Validate fields.
    validator.body('first_name').isLength({ min: 1 }).trim().withMessage('First name must be specified.')
        .isAlphanumeric().withMessage('First name has non-alphanumeric characters.'),
    validator.body('family_name').isLength({ min: 1 }).trim().withMessage('Family name must be specified.')
        .isAlphanumeric().withMessage('Family name has non-alphanumeric characters.'),
    validator.body('date_of_birth', 'Invalid date of birth').optional({ checkFalsy: true }).isISO8601(),
    validator.body('date_of_death', 'Invalid date of death').optional({ checkFalsy: true }).isISO8601(),

    // Sanitize fields.
    validator.sanitizeBody('first_name').escape(),
    validator.sanitizeBody('family_name').escape(),
    validator.sanitizeBody('date_of_birth').toDate(),
    validator.sanitizeBody('date_of_death').toDate(),

    // Process request after validation and sanitization.
    (req, res, next) => {

        // Extract the validation errors from a request.
        const errors = validator.validationResult(req);

        if (!errors.isEmpty()) {
            // There are errors. Render form again with sanitized values/errors messages.
            res.render('author_form', { title: 'Create Author', author: req.body, errors: errors.array() });
            return;
        }
        else {
            // Data from form is valid.

            // Create an Author object with escaped and trimmed data.
            var author = new Author(
                {
                    first_name: req.body.first_name,
                    family_name: req.body.family_name,
                    date_of_birth: req.body.date_of_birth,
                    date_of_death: req.body.date_of_death
                });
            author.save(function (err) {
                if (err) { return next(err); }
                // Successful - redirect to new author record.
                res.redirect(author.url);
            });
        }
    }
];

//Display author delete form on GET
exports.author_delete_get = function(req, res) {

    async.parallel({
        author: function(callback) {
            Author.findById(req.params.id).exec(callback)
        },
        authors_books: function(callback) {
          Book.find({ 'author': req.params.id }).exec(callback)
        },
    }, function(err, results) {
        if (err) { return next(err); }
        if (results.author==null) { // No results.
            res.redirect('/catalog/authors');
        }
        // Successful, so render.
        res.render('author_delete', { title: 'Delete Author', author: results.author, author_books: results.authors_books } );
    });
};

//Handle author delete on POST
exports.author_delete_post = function(req, res) {

    async.parallel({
        author: function(callback) {
          Author.findById(req.body.authorid).exec(callback)
        },
        authors_books: function(callback) {
          Book.find({ 'author': req.body.authorid }).exec(callback)
        },
    }, function(err, results) {
        if (err) { return next(err); }
        // Success
        if (results.authors_books.length > 0) {
            // Author has books. Render in same way as for GET route.
            res.render('author_delete', { title: 'Delete Author', author: results.author, author_books: results.authors_books } );
            return;
        }
        else {
            // Author has no books. Delete object and redirect to the list of authors.
            Author.findByIdAndRemove(req.body.authorid, function deleteAuthor(err) {
                if (err) { return next(err); }
                // Success - go to author list
                res.redirect('/catalog/authors')
            })
        }
    });
};

//Display author update form on GET
exports.author_update_get = function(req, res) {

    // Get book, authors and genres for form.
    async.parallel({
        author: function(callback) {
            Author.findById(req.params.id).exec(callback);
        }
    }, function(err, results) {
        if (err) { return next(err); }
        if (results.author==null) { // No results.
            var err = new Error('Author not found');
            err.status = 404;
            return next(err);
        }
        // Success.
        res.render('author_form', { title: 'Update Author', author:results.author });
    });
};

//Handle author update on POST
exports.author_update_post = [

    // Validate fields.
    validator.body('first_name', 'First name must be specified').isLength({ min: 1 }).trim(),
    validator.body('family_name', 'Family name must be specified').isLength({ min: 1 }).trim(),
    validator.body('date_of_birth', 'Invalid date').optional({ checkFalsy: true }).isISO8601(),

    // Sanitize fields.
    validator.sanitizeBody('first_name').escape(),
    validator.sanitizeBody('family_name').escape(),
    validator.sanitizeBody('date_of_birth').escape(),
    //sanitizeBody('status').escape(),

    // Process request after validation and sanitization.
    (req, res, next) => {

        // Extract the validation errors from a request.
        const errors = validator.validationResult(req);

        // Create a Book object with escaped/trimmed data and old id.
        var author = new Author(
          { first_name: req.body.first_name,
            family_name: req.body.family_name,
            date_of_birth: req.body.date_of_birth,
            date_of_death: req.body.date_of_death,
            _id:req.params.id //This is required, or a new ID will be assigned!
           });

        if (!errors.isEmpty()) {
            // There are errors so render the form again, passing sanitized values and errors.
            Author.find({})
                .exec(function (err, authors) {
                    if (err) { return next(err); }
                    // Successful, so render.
                    res.render('author_form', { title: 'Update Author', errors: errors.array(), author:author });
            });
            return;
        }
        else {
            // Data from form is valid.
            Author.findByIdAndUpdate(req.params.id, author, {}, function (err, theauthor) {
                if (err) { return next(err); }
                // Successful - redirect to detail page.
                res.redirect(theauthor.url);
            });
        }
    }
];

//Display author image upload form on GET
exports.author_image_upload_get = function(req, res) {

    // console.log('Author image upload get')
    // console.log(req.params);
    // Get author for form.
    async.parallel({
        author: function(callback) {
            Author.findById(req.params.id).exec(callback);
        }
    }, function(err, results) {
        if (err) { return next(err); }
        if (results.author==null) { // No results.
            var err = new Error('Author not found');
            err.status = 404;
            return next(err);
        }
        // console.log(results);
        // console.log("get success");
        // Success.
        res.render('author_upload_form', { title: 'Upload Author Image', author:results.author, msg:req.params.msg });
    });
};

//Handle author image upload on POST
exports.author_image_upload_post = function(req, res, next) {
    // console.log('Author image upload post')
    // console.log(req.params);
    upload(req, res, function(err) {
        if(err) {
            //console.log("Error at author image upload post");
            debug(" *** error 3");
            debug(err);
            res.redirect('..'+ '/upload/3');
            // res.render('author_upload_form', { title: 'Upload Author Image', author:req.params.author, msg:3 });
        } else {
            if(req.files == undefined){
                debug(" *** error 2");
                debug(req.files);
                res.redirect('..'+ '/upload/2');
                // res.render('author_upload_form', { title: 'Upload Author Image', author:req.params.author, msg:2 });
            }
            else {
                //console.log("***");
                //console.log(req.files);
                //console.log("===");
                async.parallel({
                    author: function(callback) {
                    Author.findById(req.params.id).exec(callback);
                    },
                }, function(err, results) {
                    if (err) { return next(err); }
                    // Success
                    //console.log(results);
                    //console.log(req.params);
                    //console.log(req.body);
                    if (results.author==null) { // No results.
                        var err = new Error('Author not found');
                        err.status = 404;
                        return next(err);
                    }
                    //console.log("author: "  + './public/images/' + req.params.id + ".jpg");
                    //console.log(req.files);
                    //console.log(req.files['author_image_file'][0].path);
                    // destination.txt will be created or overwritten by default.
                    fs.copyFile(req.files['author_image_file'][0].path, './public/images/'+req.params.id+'.jpg', (err) => {
                        if (err) throw err;
                        debug(req.files['author_image_file'][0].path + " --> " + './public/images/'+req.params.id+'.jpg');
                        var fullPath = './public/images/'+req.params.id+'.jpg';
                        // console.log(fullPath);
                        var photoData = fs.readFileSync('./public/images/'+req.params.id+'.jpg');
                        var document = {
                            link: results.author,
                            path: fullPath,
                            caption: results.author.name,
                            image_data: {contentType: 'image/png', data: photoData}
                        };
                        // console.log(document);
                        var photo = new Photo(document);
                        Photo.findOneAndUpdate({caption:results.author.name}, photo.image_data, {}, function (err, theauthor) {
                            if (err) { return next(err); }
                            //console.log(" *** err update");
                            //console.log(err);
                            if (theauthor == undefined) {
                                debug("Saving author photo for the first time.")
                                photo.save(function(error) {
                                    if(error) { throw error; }
                                    // console.log(" *** photo saved!");
                                    // Successful - go to author list
                                    res.redirect(results.author.url);
                                });
                            } else {
                                // Successful - redirect to detail page.
                                // console.log(" *** redir update " + theauthor);
                                res.redirect(theauthor.url);
                            }
                        });
                    });
                });
            }
        }
    });
};