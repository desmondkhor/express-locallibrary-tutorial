var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var AuthorPhotoSchema = new Schema({
    link: { type: Schema.Types.ObjectId, ref: 'Author', required: true }, //reference to the associated author
    path: {type: String, required: true},
    caption: {type: String, required: true},
    image_data: {contentType: String, data: Buffer}
});

//Export model
module.exports = mongoose.model('AuthorPhotos', AuthorPhotoSchema);