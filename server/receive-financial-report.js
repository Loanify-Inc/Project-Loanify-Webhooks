const fs = require('fs');
const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEYID,
  secretAccessKey: process.env.AWS_SECRET_ACCESSKEY,
  region: process.env.AWS_REGIONID,
});

const s3 = new AWS.S3();

exports.handler = async (event, context) => {
  try {
    const payload = JSON.parse(event.body);
    const filePath = payload.filePath;

    // Read the file
    const data = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(data);

    // Additional actions (e.g., upload to S3)
    const s3Params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `path/to/your/${Date.now()}_financial-report.json`, // Updated key with a timestamp
      Body: JSON.stringify(jsonData),
      ContentType: 'application/json',
    };

    const uploadResult = await s3.upload(s3Params).promise();
    console.log('File uploaded to S3:', uploadResult.Location);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'File uploaded to S3 successfully' }),
    };
  } catch (error) {
    console.error('Error:', error.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};