const fs = require('fs');
const path = require('path');
const os = require('os');
const AWS = require('aws-sdk');
const ejs = require('ejs');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEYID,
  secretAccessKey: process.env.AWS_SECRET_ACCESSKEY,
  region: process.env.AWS_REGIONID,
});

const s3 = new AWS.S3();

exports.handler = async (event, context) => {
  try {
    const payload = JSON.parse(event.body);

    // Define your HTML template (Can be externalized as well)
    const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Credit Report for <%= payload.firstName %> <%= payload.lastName %></title>
      <!-- ... -->
    </head>
    <body>
      <h1>Credit Report for <%= payload.firstName %> <%= payload.lastName %></h1>
      <!-- ... render other payload data ... -->
    </body>
    </html>
    `;

    // Generate HTML content
    const htmlContent = ejs.render(htmlTemplate, { payload });

    // Save the HTML content to a temporary file
    const tempFilePath = path.join(os.tmpdir(), `credit-report-${Date.now()}.html`);
    fs.writeFileSync(tempFilePath, htmlContent);

    // Upload to S3
    const filename = `credit-reports/credit-report-${Date.now()}.html`;
    const s3Params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: filename,
      Body: fs.createReadStream(tempFilePath),
      ContentType: 'text/html',
    };

    const uploadResult = await s3.upload(s3Params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'File uploaded to S3 successfully', url: uploadResult.Location }),
    };
  } catch (error) {
    console.error('Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};