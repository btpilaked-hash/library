require('dotenv').config();
const mongoose  = require('mongoose');
const cloudinary = require('cloudinary').v2;
const path      = require('path');
const Book      = require('./models/shelf_a');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function migrate() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to Atlas");

    const books = await Book.find({});
    let success = 0;
    let failed  = 0;

    for (const book of books) {
        try {
            // Get local file path
            const localPath = path.join(__dirname, book.image);

            // Upload to Cloudinary
            const result = await cloudinary.uploader.upload(localPath, {
                folder:    'ccit_library',
                public_id: book.isbn.replace(/[^a-zA-Z0-9]/g, '_'), // use ISBN as filename
            });

            // Update Atlas with Cloudinary URL
            await Book.findByIdAndUpdate(book._id, { image: result.secure_url });
            console.log(`✓ ${book.title} → ${result.secure_url}`);
            success++;
        } catch (err) {
            console.log(`✗ Failed: ${book.title} — ${err.message}`);
            failed++;
        }
    }

    console.log(`\nDone. Success: ${success} | Failed: ${failed}`);
    mongoose.disconnect();
}

migrate().catch(console.error);
