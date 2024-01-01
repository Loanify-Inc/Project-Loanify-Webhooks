const AWS = require('aws-sdk');
const axios = require('axios');
const ejs = require('ejs');
const html2canvas = require('html2canvas');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEYID,
  secretAccessKey: process.env.AWS_SECRET_ACCESSKEY,
  region: process.env.AWS_REGIONID,
});

const s3 = new AWS.S3();

exports.handler = async (event, context) => {
  // Assume event.body contains base64-encoded PNG data
  const payload = JSON.parse(event.body);

  // Fetch the template content from the URL using axios
  const templateUrl = 'https://harmonious-mike.netlify.app/template/template.ejs';
  try {
    const response = await axios.get(templateUrl);
    const templateContent = response.data; // Adjust here based on the structure of the response

    // Generate HTML from EJS template
    const html = ejs.render(templateContent, { payload });

    // Convert HTML to PNG using html2canvas
    const canvas = await html2canvas(document.createElement('div', { innerHTML: html }));
    const imgData = canvas.toDataURL('image/png');

    // Generate a random name with a timestamp
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const randomName = `image_${timestamp}_${Math.random().toString(36).substring(2, 8)}`;

    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `path/to/your/${randomName}.png`, // Updated key with a random name
      Body: Buffer.from(imgData.split(',')[1], 'base64'),
      ContentType: 'image/png',
    };

    const uploadResult = await s3.upload(params).promise();
    console.log('Image uploaded successfully:', uploadResult.Location);
    return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Image uploaded successfully' }) };
  } catch (error) {
    console.error('Error:', error.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};