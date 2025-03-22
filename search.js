const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });
//  เปลี่ยนฐานข้อมูลให้เป็นของตนเอง โดยเปลี่ยน kkustockphoto เป็นชื่อฐานข้อมูลของตนเอง
mongoose.connect('mongodb://localhost:27017/kkustockphoto', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Album Schema
const albumSchema = new mongoose.Schema({
    album_name: { type: String, required: true, unique: true },
    album_cover: { data: Buffer, contentType: String },
    category: [{
        type: String,
        enum: [
            'ภาพวิวและพื้นที่ส่วนกลาง',
            'ภาพสิ่งอำนวยความสะดวก และการใช้ชีวิตใน มข.',
            'ภาพการเรียนการสอน',
            'ภาพการวิจัยและนวัตกรรม',
            'ภาพเทรนด์ ภาพ ดิจิทัล',
            'ภาพผู้บริหาร มข.',
            'ภาพศิลปวัฒนธรรมและศิลปสร้างสรรค์',
            'ภาพกิจกรรมลงชุมชน (CSV)',
            'ภาพนานาชาติ',
            'ภาพปริญญาบัตร และรัฐพิธีสำคัญ',
            'ภาพมุมสูง ต่างๆ',
            'ภาพวิทยาศาสตร์-และวิทยาศาสตร์สุขภาพ',
            'โลโก้ 60 ปี มข. จากศูนย์ศิลปวัฒนธรรม มข.',
            'กีฬา',
            'คอนเสิร์ต-การแสดง'
        ]
    }],
    created_at: { type: Date, default: Date.now }
});
const Album = mongoose.model('Album', albumSchema);

// Image Schema
const imageSchema = new mongoose.Schema({
    title: { type: String, required: true },
    thumbnail: { data: Buffer, contentType: String },
    fullsize: { data: Buffer, contentType: String },
    photographer: { type: String, required: true },
    tags: [{ type: String }],
    album_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Album', required: true },
    uploaded_at: { type: Date, default: Date.now },
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 }
});

imageSchema.index({ tags: 1 });
imageSchema.index({ photographer: 1 });
imageSchema.index({ album_id: 1 });
imageSchema.index({ views: -1 });
imageSchema.index({ downloads: -1 });
imageSchema.index({ uploaded_at: -1 });

const Image = mongoose.model('Image', imageSchema);

// PendingTag Schema
const pendingTagSchema = new mongoose.Schema({
    tag_name: { type: String, required: true, unique: true },
    requested_by: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    requested_at: { type: Date, default: Date.now }
});
const PendingTag = mongoose.model('PendingTag', pendingTagSchema);

// API: ดึงรายการแท็กที่ใช้ได้
app.get('/tags', async (req, res) => {
    try {
        const tags = await Image.distinct('tags');
        res.json(tags);
    } catch (error) {
        console.error('Error in /tags:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: สร้างอัลบั้มและอัปโหลดรูปภาพ
app.post('/create-and-upload', upload.fields([
    { name: 'album_cover', maxCount: 1 },
    { name: 'images', maxCount: 100 }
]), async (req, res) => {
    try {
        console.log('Received /create-and-upload request:', req.body, req.files);
        const { album_name, photographer } = req.body;
        if (!album_name || !photographer || !req.files['images'] || req.files['images'].length === 0) {
            return res.status(400).json({ error: 'Missing required fields (album_name, photographer, images)' });
        }

        let album = await Album.findOne({ album_name });
        if (!album) {
            album = new Album({
                album_name,
                album_cover: req.files['album_cover'] ? {
                    data: req.files['album_cover'][0].buffer,
                    contentType: req.files['album_cover'][0].mimetype
                } : undefined
            });
            await album.save();
            console.log(`Created new album: ${album_name}`);
        } else if (!album.album_cover && req.files['album_cover']) {
            album.album_cover = {
                data: req.files['album_cover'][0].buffer,
                contentType: req.files['album_cover'][0].mimetype
            };
            await album.save();
            console.log(`Updated album cover for: ${album_name}`);
        }

        const images = req.files['images'].map((file, index) => {
            return new Image({
                title: `Image ${index + 1} - ${album.album_name}`,
                thumbnail: { data: file.buffer, contentType: file.mimetype },
                fullsize: { data: file.buffer, contentType: file.mimetype },
                photographer,
                tags: [],
                album_id: album._id
            });
        });

        await Image.insertMany(images);
        console.log(`Uploaded ${images.length} images to album ${album.album_name}`);
        res.status(201).json({ message: `${images.length} images uploaded to album ${album.album_name}`, album_id: album._id });
    } catch (error) {
        console.error('Error in /create-and-upload:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: กำหนดหมวดหมู่ให้อัลบั้ม
app.post('/album/:id/category', async (req, res) => {
    try {
        const { category } = req.body;
        if (!category || !Array.isArray(category)) {
            return res.status(400).json({ error: 'Category must be an array' });
        }

        const album = await Album.findById(req.params.id);
        if (!album) {
            return res.status(404).json({ error: 'Album not found' });
        }

        album.category = category;
        await album.save();

        res.json({ message: `Category updated for album ${album.album_name}` });
    } catch (error) {
        console.error('Error in /album/:id/category:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: กำหนดแท็กให้รูปภาพ
app.post('/image/:id/tags', async (req, res) => {
    try {
        const { tags } = req.body;
        if (!tags || !Array.isArray(tags)) {
            return res.status(400).json({ error: 'Tags must be an array' });
        }

        const filteredTags = tags.filter(tag => tag && tag.trim() !== '');

        const image = await Image.findById(req.params.id);
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }

        image.tags = filteredTags;
        await image.save();
        res.json({ message: 'Tags updated for image' });
    } catch (error) {
        console.error('Error in /image/:id/tags:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ขอเพิ่มแท็กใหม่
app.post('/request-tag', async (req, res) => {
    try {
        const { tag_name, requested_by } = req.body;
        if (!tag_name || !requested_by) {
            return res.status(400).json({ error: 'Missing required fields (tag_name, requested_by)' });
        }

        const existingTag = await PendingTag.findOne({ tag_name });
        if (!existingTag) {
            const newTag = new PendingTag({ tag_name, requested_by, status: 'approved' });
            await newTag.save();
        }

        res.status(201).json({ message: 'Tag added successfully' });
    } catch (error) {
        console.error('Error in /request-tag:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดึงรูปภาพโดยตรง (thumbnail)
app.get('/image/:id/thumbnail', async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image || !image.thumbnail || !image.thumbnail.data) {
            return res.status(404).json({ error: 'Image or thumbnail not found' });
        }

        // เพิ่ม View Count
        image.views += 1;
        await image.save();

        res.set('Content-Type', image.thumbnail.contentType);
        res.send(image.thumbnail.data);
    } catch (error) {
        console.error('Error in /image/:id/thumbnail:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดึงรูปภาพขนาดเต็ม (fullsize)
app.get('/image/:id/fullsize', async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image || !image.fullsize || !image.fullsize.data) {
            return res.status(404).json({ error: 'Image or fullsize not found' });
        }

        // เพิ่ม View Count
        image.views += 1;
        await image.save();

        res.set('Content-Type', image.fullsize.contentType);
        res.send(image.fullsize.data);
    } catch (error) {
        console.error('Error in /image/:id/fullsize:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดาวน์โหลดรูปภาพ (เพิ่ม Download Count)
app.get('/image/:id/download', async (req, res) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image || !image.fullsize || !image.fullsize.data) {
            return res.status(404).json({ error: 'Image or fullsize not found' });
        }

        // เพิ่ม Download Count
        image.downloads += 1;
        await image.save();

        res.set('Content-Type', image.fullsize.contentType);
        res.set('Content-Disposition', `attachment; filename="${image.title}.jpg"`);
        res.send(image.fullsize.data);
    } catch (error) {
        console.error('Error in /image/:id/download:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดึง album cover โดยตรง
app.get('/album/:id/cover', async (req, res) => {
    try {
        const album = await Album.findById(req.params.id);
        if (!album || !album.album_cover || !album.album_cover.data) {
            return res.status(404).json({ error: 'Album or cover not found' });
        }

        res.set('Content-Type', album.album_cover.contentType);
        res.send(album.album_cover.data);
    } catch (error) {
        console.error('Error in /album/:id/cover:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดึงรายการอัลบั้มทั้งหมด
app.get('/albums', async (req, res) => {
    try {
        const albums = await Album.aggregate([
            {
                $lookup: {
                    from: 'images',
                    localField: '_id',
                    foreignField: 'album_id',
                    as: 'images'
                }
            },
            {
                $project: {
                    _id: 1,
                    album_name: 1,
                    album_cover: 1,
                    category: 1,
                    image_count: { $size: '$images' },
                    created_at: 1
                }
            },
            { $sort: { created_at: -1 } }
        ]);
        res.json(albums);
    } catch (error) {
        console.error('Error in /albums:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดึงรูปภาพทั้งหมด (รองรับการเรียงลำดับ)
app.get('/images', async (req, res) => {
    try {
        const { sortBy } = req.query; // รับพารามิเตอร์ sortBy (เช่น downloads, views, uploaded_at)
        let sortOption = { uploaded_at: -1 }; // ค่าเริ่มต้น: เรียงตามวันที่อัปโหลด (ล่าสุดก่อน)

        if (sortBy === 'downloads') {
            sortOption = { downloads: -1 }; // เรียงตาม Download Count (มากไปน้อย)
        } else if (sortBy === 'views') {
            sortOption = { views: -1 }; // เรียงตาม View Count (มากไปน้อย)
        }

        const images = await Image.aggregate([
            { $lookup: { from: 'albums', localField: 'album_id', foreignField: '_id', as: 'album' } },
            { $unwind: { path: '$album', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    thumbnail: 1,
                    photographer: 1,
                    tags: 1,
                    album_name: { $ifNull: ['$album.album_name', null] },
                    uploaded_at: 1,
                    views: 1,
                    downloads: 1
                }
            },
            { $sort: sortOption }
        ]);
        res.json(images);
    } catch (error) {
        console.error('Error in /images:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดึงรูปภาพในอัลบั้มที่ระบุ (รองรับการเรียงลำดับ)
app.get('/album/:id/images', async (req, res) => {
    try {
        const albumId = req.params.id;
        const { sortBy } = req.query; // รับพารามิเตอร์ sortBy
        let sortOption = { uploaded_at: -1 }; // ค่าเริ่มต้น: เรียงตามวันที่อัปโหลด (ล่าสุดก่อน)

        if (sortBy === 'downloads') {
            sortOption = { downloads: -1 }; // เรียงตาม Download Count (มากไปน้อย)
        } else if (sortBy === 'views') {
            sortOption = { views: -1 }; // เรียงตาม View Count (มากไปน้อย)
        }

        const images = await Image.aggregate([
            { $match: { album_id: new mongoose.Types.ObjectId(albumId) } },
            { $lookup: { from: 'albums', localField: 'album_id', foreignField: '_id', as: 'album' } },
            { $unwind: { path: '$album', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    thumbnail: 1,
                    photographer: 1,
                    tags: 1,
                    album_name: { $ifNull: ['$album.album_name', null] },
                    uploaded_at: 1,
                    views: 1,
                    downloads: 1
                }
            },
            { $sort: sortOption }
        ]);
        res.json(images);
    } catch (error) {
        console.error('Error in /album/:id/images:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: ค้นหาคำที่ใกล้เคียงจาก Tags, Album, Category
app.get('/search', async (req, res) => {
    try {
        const { query, sortBy } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        let sortOption = { uploaded_at: -1 }; // ค่าเริ่มต้น
        if (sortBy === 'downloads') {
            sortOption = { downloads: -1 };
        } else if (sortBy === 'views') {
            sortOption = { views: -1 };
        }

        // ค้นหาอัลบั้ม
        const albums = await Album.find({
            $or: [
                { album_name: { $regex: query, $options: 'i' } },
                { category: { $regex: query, $options: 'i' } }
            ]
        });

        // ค้นหารูปภาพ
        const images = await Image.aggregate([
            {
                $lookup: { from: 'albums', localField: 'album_id', foreignField: '_id', as: 'album' }
            },
            { $unwind: { path: '$album', preserveNullAndEmptyArrays: true } },
            {
                $match: {
                    $or: [
                        { title: { $regex: query, $options: 'i' } },
                        { tags: { $regex: query, $options: 'i' } },
                        { photographer: { $regex: query, $options: 'i' } },
                        { 'album.album_name': { $regex: query, $options: 'i' } },
                        { 'album.category': { $regex: query, $options: 'i' } }
                    ]
                }
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    thumbnail: 1,
                    photographer: 1,
                    tags: 1,
                    album_name: { $ifNull: ['$album.album_name', null] },
                    uploaded_at: 1,
                    views: 1,
                    downloads: 1
                }
            },
            { $sort: sortOption }
        ]);

        res.json({ albums, images });
    } catch (error) {
        console.error('Error in /search:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));