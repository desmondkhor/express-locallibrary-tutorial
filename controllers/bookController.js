const { body, validationResult } = require('express-validator');
const { sanitizeBody } = require('express-validator');
var Book = require('../models/book');
var Author = require('../models/author');
var Genre = require('../models/genre');
var BookInstance = require('../models/bookinstance');
var AuthorPhoto = require('../models/author_photo');
var BookPhoto = require('../models/book_photo');
var async = require('async');
var fs = require('fs');
var multer = require('multer');
var path = require('path');
var debug = require('debug')('book');

/**
 * Converts an html characterSet into its original character.
 *
 * @param {String} str htmlSet entities
 **/
var decode = function(str) {
    //console.log('str: ' + str);
    var s = str.replace(/&#x(\d+);/g, function(match, dec) {
        //console.log(match, dec, parseInt(dec.toString(), 16));
        return String.fromCharCode(parseInt(dec.toString(), 16));
    });
    //console.log('s: ' + s)
    //console.log(String.fromCharCode(39));
    return s;
	//return str.replace(/&#(\d+);/g, function(match, dec) {
	//	return String.fromCharCode(dec);
    //});
}

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
    //{name: 'file1'},
    {name: 'book_image_file'}
    //{name: 'author_image_file'}
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

exports.index = function(req, res) {

    async.parallel({
        book_count: function(callback) {
            Book.countDocuments({}, callback); // Pass an empty object as match condition to find all documents of this collection
        },
        book_instance_count: function(callback) {
            BookInstance.countDocuments({}, callback);
        },
        book_instance_available_count: function(callback) {
            BookInstance.countDocuments({status:'Available'}, callback);
        },
        author_count: function(callback) {
            Author.countDocuments({}, callback);
        },
        genre_count: function(callback) {
            Genre.countDocuments({}, callback);
        },
        author_photo_count: function(callback) {
            AuthorPhoto.countDocuments({}, callback);
        },
        book_photo_count: function(callback) {
            BookPhoto.countDocuments({}, callback);
        }
    }, function(err, results) {
        res.render('index', { title: 'Local Library Home', error: err, data: results });
    });
};

// Display list of all books.
exports.book_list = function(req, res, next) {

    Book.find({}, 'title author')
    .populate('author')
    .exec(function (err, list_books) {
      if (err) { return next(err); }
      //Successful, so render
      res.render('book_list', { title: 'Book List', book_list: list_books });
    });
};

// Display detail page for a specific book.
exports.book_detail = function(req, res, next) {
    async.parallel({
        book: function(callback) {

            Book.findById(req.params.id)
            .populate('author')
            .populate('genre')
            .exec(callback);
        },
        book_instance: function(callback) {

          BookInstance.find({ 'book': req.params.id })
          .sort({status: 'asc'})
          .exec(callback);
        },
    }, function(err, results) {
        if (err) { return next(err); }
        if (results.book==null) { // No results.
            var err = new Error('Book not found');
            err.status = 404;
            return next(err);
        }
        // Successful, so render.
        res.render('book_detail', { title: results.book.title, book: results.book, book_instances: results.book_instance } );
    });
};

// Display book create form on GET.
exports.book_create_get = function(req, res) {

    // Get all authors and genres, which we can use for adding to our book.
    async.parallel({
        authors: function(callback) {
            Author.find(callback);
        },
        genres: function(callback) {
            Genre.find(callback);
        },
    }, function(err, results) {
        if (err) { return next(err); }
        res.render('book_form', { title: 'Create Book', authors: results.authors, genres: results.genres });
    });
};

// Handle book create on POST.
exports.book_create_post = [
    // Convert the genre to an array.
    (req, res, next) => {
        if(!(req.body.genre instanceof Array)){
            if(typeof req.body.genre==='undefined')
                req.body.genre=[];
            else
                req.body.genre=new Array(req.body.genre);
        }
        debug(" *** create genre: " + req.body.genre);
        next();
    },

    // Validate fields.
    body('title', 'Title must not be empty.').isLength({ min: 1 }).trim().escape(),
    body('author', 'Author must not be empty.').isLength({ min: 1 }).trim().escape(),
    body('summary', 'Summary must not be empty.').isLength({ min: 1 }).trim().escape(),
    body('isbn', 'ISBN must not be empty').isLength({ min: 1 }).trim().escape(),

    // Sanitize fields (using wildcard).
    //sanitizeBody('*').escape(),

    // Process request after validation and sanitization.
    (req, res, next) => {

        // Extract the validation errors from a request.
        const errors = validationResult(req);

        // Create a Book object with escaped and trimmed data.
        var book = new Book(
        {   title: decode(req.body.title),
            author: req.body.author,
            summary: decode(req.body.summary),
            isbn: req.body.isbn,
            genre: req.body.genre
        });

        //console.log(" *** validate, genre: " + req.body.genre);
        //console.log(" *** genre is: " + book.genre);

        if (!errors.isEmpty()) {
            // There are errors. Render form again with sanitized values/error messages.

            // Get all authors and genres for form.
            async.parallel({
                authors: function(callback) {
                    Author.find(callback);
                },
                genres: function(callback) {
                    Genre.find(callback);
                },
            }, function(err, results) {
                if (err) { return next(err); }

                //console.log(" *** genre len: " + results.genres.length);
                // Mark our selected genres as checked.
                for (let i = 0; i < results.genres.length; i++) {
                    //console.log(" *** genre: " + results.genres[i]);
                    if (book.genre.indexOf(results.genres[i]._id) > -1) {
                        results.genres[i].checked='true';
                    }
                }
                res.render('book_form', { title: 'Create Book',authors:results.authors, genres:results.genres, book: book, errors: errors.array() });
            });
            return;
        }
        else {
            debug(" *** save book " + book.genre.length);
            // Data from form is valid. Save book.
            book.save(function (err) {
                if (err) { return next(err); }
                   //successful - redirect to new book record.
                   res.redirect(book.url);
                });
        }
    }
];

// Display book delete form on GET.
exports.book_delete_get = function(req, res) {

    async.parallel({
        book: function(callback) {
            Book.findById(req.params.id).exec(callback)
        },
        book_instances: function(callback) {
          BookInstance.find({ 'book': req.params.id }).populate('book').exec(callback)
        },
    }, function(err, results) {
        if (err) { return next(err); }
        if (results.book==null) { // No results.
            res.redirect('/catalog/books');
        }
        // Successful, so render.
        res.render('book_delete', { title: 'Delete Book', book: results.book, book_instances: results.book_instances } );
    });
};

// Handle book delete on POST.
exports.book_delete_post = function(req, res) {

    async.parallel({
        author: function(callback) {
          Book.findById(req.body.bookid).exec(callback)
        },
        book_instances: function(callback) {
          BookInstance.find({ 'book': req.body.bookid }).exec(callback)
        },
    }, function(err, results) {
        if (err) { return next(err); }
        // Success
        if (results.book_instances.length > 0) {
            // Book has instances. Render in same way as for GET route.
            res.render('bookinstance_delete', { title: 'Delete Book Instance', book: results.book, book_instances: results.book_instances } );
            return;
        }
        else {
            // Book has no instance. Delete object and redirect to the list of books.
            Book.findByIdAndRemove(req.body.bookid, function deleteBook(err) {
                if (err) { return next(err); }
                // Success - go to author list
                res.redirect('/catalog/books')
            })
        }
    });
};

// Display book update form on GET.
exports.book_update_get = function(req, res) {

    // Get book, authors and genres for form.
    async.parallel({
        book: function(callback) {
            Book.findById(req.params.id).populate('author').populate('genre').exec(callback);
        },
        authors: function(callback) {
            Author.find(callback);
        },
        genres: function(callback) {
            Genre.find(callback);
        },
    }, function(err, results) {
        if (err) { return next(err); }
        if (results.book==null) { // No results.
            var err = new Error('Book not found');
            err.status = 404;
            return next(err);
        }
        // Success.
        // Mark our selected genres as checked.
        for (var all_g_iter = 0; all_g_iter < results.genres.length; all_g_iter++) {
            for (var book_g_iter = 0; book_g_iter < results.book.genre.length; book_g_iter++) {
                if (results.genres[all_g_iter]._id.toString()==results.book.genre[book_g_iter]._id.toString()) {
                    results.genres[all_g_iter].checked='true';
                }
            }
        }
        res.render('book_form', { title: 'Update Book', authors: results.authors, genres: results.genres, book: results.book });
    });
};

// Handle book update on POST.
exports.book_update_post = [

    // Convert the genre to an array
    (req, res, next) => {
        if(!(req.body.genre instanceof Array)){
            if(typeof req.body.genre==='undefined')
            req.body.genre=[];
            else
            req.body.genre=new Array(req.body.genre);
        }
        next();
    },

    // Validate fields.
    body('title', 'Title must not be empty.').isLength({ min: 1 }).trim(),
    body('author', 'Author must not be empty.').isLength({ min: 1 }).trim(),
    body('summary', 'Summary must not be empty.').isLength({ min: 1 }).trim(),
    body('isbn', 'ISBN must not be empty').isLength({ min: 1 }).trim(),

    // Sanitize fields.
    sanitizeBody('title').escape(),
    sanitizeBody('author').escape(),
    sanitizeBody('summary').escape(),
    sanitizeBody('isbn').escape(),
    sanitizeBody('genre.*').escape(),

    // Process request after validation and sanitization.
    (req, res, next) => {

        // Extract the validation errors from a request.
        const errors = validationResult(req);

        //console.log("***** " + req.body.title);
        //console.log(decode(req.body.title));

        // Create a Book object with escaped/trimmed data and old id.
        var book = new Book(
          { title: decode(req.body.title),
            author: req.body.author,
            summary: decode(req.body.summary),
            isbn: req.body.isbn,
            genre: (typeof req.body.genre==='undefined') ? [] : req.body.genre,
            _id:req.params.id //This is required, or a new ID will be assigned!
           });

        if (!errors.isEmpty()) {
            // There are errors. Render form again with sanitized values/error messages.

            // Get all authors and genres for form.
            async.parallel({
                authors: function(callback) {
                    Author.find(callback);
                },
                genres: function(callback) {
                    Genre.find(callback);
                },
            }, function(err, results) {
                if (err) { return next(err); }

                // Mark our selected genres as checked.
                for (let i = 0; i < results.genres.length; i++) {
                    if (book.genre.indexOf(results.genres[i]._id) > -1) {
                        results.genres[i].checked='true';
                    }
                }
                res.render('book_form', { title: 'Update Book',authors: results.authors, genres: results.genres, book: book, errors: errors.array() });
            });
            return;
        }
        else {
            // Data from form is valid. Update the record.
            Book.findByIdAndUpdate(req.params.id, book, {}, function (err,thebook) {
                if (err) { return next(err); }
                   // Successful - redirect to book detail page.
                   res.redirect(thebook.url);
                });
        }
    }
];

//Display book image upload form on GET
exports.book_image_upload_get = function(req, res) {

    //console.log('Book image upload get')
    //console.log(req.params);
    // Get author for form.
    async.parallel({
        book: function(callback) {
            Book.findById(req.params.id).exec(callback);
        }
    }, function(err, results) {
        if (err) { return next(err); }
        if (results.book==null) { // No results.
            var err = new Error('Book not found');
            err.status = 404;
            return next(err);
        }
        //console.log(results);
        //console.log("get success");
        // Success.
        res.render('book_upload_form', { title: 'Upload Book Image', book:results.book, msg:req.params.msg });
    });
};

//Handle book image upload on POST
exports.book_image_upload_post = function(req, res, next) {
    //console.log('Book image upload post')
    // console.log(req.params);
    upload(req, res, function(err) {
        if(err) {
            //console.log("Error at book image upload post");
            debug(" *** error 3");
            debug(err);
            res.redirect('..'+ '/upload/3');
            // res.render('book_upload_form', { title: 'Upload Book Image', book:req.params.book, msg:3 });
        } else {
            if(req.files == undefined){
                debug(" *** error 2");
                //console.log(req.files);
                res.redirect('..'+ '/upload/2');
                // res.render('book_upload_form', { title: 'Upload Book Image', book:req.params.book, msg:2 });
            }
            else {
                //console.log(req.files);
                async.parallel({
                    book: function(callback) {
                    Book.findById(req.params.id).exec(callback);
                    },
                }, function(err, results) {
                    if (err) { return next(err); }
                    // Success
                    //console.log(results);
                    //console.log(req.params);
                    //console.log(req.body);
                    if (results.book==null) { // No results.
                        var err = new Error('Book not found');
                        err.status = 404;
                        return next(err);
                    }
                    // console.log("book: "  + './public/images/' + req.params.id + ".jpg");
                    // console.log(req.files);
                    // console.log(req.files['book_image_file'][0].path);
                    // destination.txt will be created or overwritten by default.
                    fs.copyFile(req.files['book_image_file'][0].path, './public/images/'+req.params.id+'.jpg', (err) => {
                        if (err) throw err;
                        debug(req.files['book_image_file'][0].path + " --> " + './public/images/'+req.params.id+'.jpg');
                        var fullPath = './public/images/'+req.params.id+'.jpg';
                        debug('fullPath: ' + fullPath);

                        var photoData = fs.readFileSync('./public/images/'+req.params.id+'.jpg');
                        var document = {
                            link: results.book,
                            path: fullPath,
                            caption: results.book.title,
                            image_data: {contentType: 'image/png', data: photoData}
                        };
                        //console.log(document);
                        //console.log(results.book.title);

                        var book_photo = new BookPhoto(document);
                        // console.log(req.params.id);
                        BookPhoto.findOneAndUpdate({caption:results.book.title}, book_photo.image_data, {}, function (err, thebook) {
                            if (err) { return next(err); }
                            // console.log(thebook);
                            // console.log(thebook == undefined);
                            if (thebook == undefined) {
                                debug("Saving book photo for the first time.")
                                book_photo.save(function(error) {
                                    if(error) { throw error; }
                                    debug(" *** book photo saved!");
                                    // Successful - go to book list
                                    res.redirect(results.book.url);
                                });
                            } else {
                                // Successful - redirect to detail page.
                                // console.log(" *** redir book update " + thebook);
                                res.redirect(thebook.url);
                            }
                        });
                    });
                });
            }
        }
    });
};