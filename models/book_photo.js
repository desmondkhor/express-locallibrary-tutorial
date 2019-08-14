var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var BookPhotoSchema = new Schema({
    link: { type: Schema.Types.ObjectId, ref: 'Book', required: true }, //reference to the associated book
    path: {type: String, required: true},
    caption: {type: String, required: true},
    image_data: {contentType: String, data: Buffer}
});

//Export model
module.exports = mongoose.model('BookPhotos', BookPhotoSchema);