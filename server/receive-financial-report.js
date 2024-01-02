const AWS = require('aws-sdk');
const ejs = require('ejs');
const os = require('os');
const fs = require('fs');
const path = require('path');

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEYID,
    secretAccessKey: process.env.AWS_SECRET_ACCESSKEY,
    region: process.env.AWS_REGIONID,
});

const s3 = new AWS.S3();

exports.handler = async (event, context) => {
    try {
        const payload = JSON.parse(event.body);

        console.log("Printing the payload>>>", payload)

        // Define your HTML template (You can also load this from an external file)
        const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Credit Report</title>
      <!-- Include any necessary styles or external scripts here -->
    </head>
    <body>
      <h1>Credit Report for <%= payload.firstName %> <%= payload.lastName %></h1>
      <p>Prepared by: <%= payload.preparedBy %></p>
      <p>Credit Score: <%= payload.creditScore %></p>
      <h2>Red Flag Codes</h2>
        <% if (payload.redFlagCodes && payload.redFlagCodes.length > 0) { %>
            <ul>
            <% payload.redFlagCodes.forEach(code => { %>
                <li><%= code %></li>
            <% }); %>
            </ul>
        <% } else { %>
            <p>No red flag codes available.</p>
        <% } %>
      <!-- Include other sections based on your report structure -->
    </body>
    </html>
    `;

        // Generate HTML content
        const htmlContent = ejs.render(htmlTemplate, { payload });

        // Save the HTML content to a temporary file
        const tempFilePath = path.join(os.tmpdir(), `credit-report-${Date.now()}.html`);
        fs.writeFileSync(tempFilePath, htmlContent);

        // Upload to S3
        const s3Params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: `credit-reports/${path.basename(tempFilePath)}`,
            Body: fs.createReadStream(tempFilePath),
            ContentType: 'text/html',
        };

        const uploadResult = await s3.upload(s3Params).promise();
        console.log('File uploaded to S3:', uploadResult.Location);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'File uploaded to S3 successfully', url: uploadResult.Location }),
        };
    } catch (error) {
        console.error('Error:', error.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
    }
};
