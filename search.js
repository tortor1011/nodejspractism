const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

mongoose.connect('mongodb://localhost:27017/kkustockphoto', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

const imageSchema = new mongoose.Schema({
    title: { type: String, required: true },
    thumbnail: { data: Buffer, contentType: String },
    fullsize: { data: Buffer, contentType: String },
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
    photographer: { type: String, required: true },
    tags: { type: String },
    uploaded_at: { type: Date, default: Date.now },
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 }
});

imageSchema.index({ category: 1 });
imageSchema.index({ uploaded_at: -1 });

const Image = mongoose.model('Image', imageSchema);

// API: อัปโหลดรูปภาพ
app.post('/upload/image', upload.fields([{ name: 'thumbnail' }, { name: 'fullsize' }]), async (req, res) => {
    try {
        const { title, category, photographer, tags } = req.body;
        console.log('Received:', { title, category, photographer, tags });
        const newImage = new Image({
            title,
            thumbnail: { data: req.files['thumbnail'][0].buffer, contentType: req.files['thumbnail'][0].mimetype },
            fullsize: { data: req.files['fullsize'][0].buffer, contentType: req.files['fullsize'][0].mimetype },
            category: category.split(','),
            photographer,
            tags
        });
        await newImage.save();
        res.status(201).json({ message: 'Image uploaded', id: newImage._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// API: ดึงรายการรูปภาพทั้งหมด
app.get('/images', async (req, res) => {
    try {
        const images = await Image.find().sort({ uploaded_at: -1 });
        res.json(images);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// API: ค้นหารูปภาพ (เพิ่ม fuzzy search)
app.get('/search', async (req, res) => {
    try {
        const { category, keyword } = req.query;
        let query = {};

        // ค้นหาตามหมวดหมู่
        if (category) {
            query.category = { $in: category.split(',') };
        }

        // ค้นหาตาม keyword ด้วย $regex (fuzzy search)
        if (keyword) {
            const regex = new RegExp(keyword, 'i'); // 'i' สำหรับ case-insensitive
            query.$or = [
                { title: { $regex: regex } },
                { tags: { $regex: regex } },
                { category: { $regex: regex } }
            ];
        }

        const images = await Image.find(query).sort({ uploaded_at: -1 });
        res.json(images);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));