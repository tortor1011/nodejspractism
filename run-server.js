const express = require('express');
const app = express();
const cors = require('cors')
const mongoose = require('mongoose')
app.use(cors())
app.use(express.json())

// start connection node expressJS and MongoDB 
mongoose.connect('mongodb://localhost:27017/kkustockphoto', { // link from mongodb compass click dot 3 point at database choose 'copy connection srtring' 
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('MongoDB connected successfully');
}).catch((err) => {
    console.error('MongoDB connection error:', err);
});
// end connection node expressJS and MongoDB 

// start schema
const customerSchema = new mongoose.Schema(
    { 
        customer_name1: String, 
        customer_position: String,
        customer_salary: String 
    }
);
// end schema

// start create table 
const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
// end create table 

app.post('/insertData/customer', async (req, res)=>{
    try {
        // รับข้อมูลจาก frontend ชื่อในปีกกาต้องตรงกันกับที่ส่งมาจาก frontend 
        const {customer_name1, customer_position, customer_salary} =  req.body;

        // นำข้อมูลที่รับจาก frontend มาบันทึกใน ตาราง 
        const xxx = new Customer({customer_name1, customer_position, customer_salary});
        await xxx.save();

        // แสดงข้อความว่าบันทึกสำเร็จ
        res.json({statusName: 'save success.'})

    } catch (error) {
        console.log(error.message);
    }
})
app.get('/list/customer', async (req, res) => {
    // find คือการดึงข้อมูลจากตาราง Customer มาทั้งหมด
    var data = await Customer.find();
    res.json({data})
})
app.listen(3000,(req, res)=>{
    console.log('start server')
})