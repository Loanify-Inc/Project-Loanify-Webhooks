const https = require('https');
const pdf = require('html-pdf');
const fs = require('fs');
const AWS = require('aws-sdk'); // Uncomment this line if using AWS S3
// const Backblaze = require('backblaze-b2'); // Uncomment this line if using Backblaze B2

exports.handler = async (event, context) => {
  const API_KEY = process.env.API_KEY;
  const BASE_URL = 'api.forthcrm.com';

// Set your AWS credentials and region from environment variables
  AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEYID,
    secretAccessKey: process.env.AWS_SECRET_ACCESSKEY,
    region: process.env.AWS_REGIONID,
  });

 // Extract data from the request object
const {
  firstName,
  lastName,
  preparedBy,
  creditScore,
  redFlagCodes,
  debts,
  creditUtilization,
  totalDebt,
  currentSituation,
  debtModificationProgram,
} = JSON.parse(event.body);

// Add your logic to process the extracted data and construct the response object
const processedData = {
  firstName,
  lastName,
  preparedBy,
  creditScore,
  redFlagCodes,
  debts,
  creditUtilization,
  totalDebt,
  currentSituation: {
    monthlyPayment: currentSituation.monthlyPayment,
    payoffTime: currentSituation.payoffTime,
    interestCost: currentSituation.interestCost,
    totalCost: currentSituation.totalCost,
  },
  debtModificationProgram: {
    monthlyPayment: debtModificationProgram.monthlyPayment,
    payoffTime: debtModificationProgram.payoffTime,
    interestCost: debtModificationProgram.interestCost,
    totalCost: debtModificationProgram.totalCost,
  },
  // Add other processed data as needed
};


  // Generate financial report (replace this with your actual report generation logic)
  const financialReportHtml = generateFinancialReport(processedData);

  // Convert HTML to PDF
  const pdfBuffer = await convertHtmlToPdf(financialReportHtml);

  // Uncomment the appropriate section for object storage (AWS S3 or Backblaze B2)
  // AWS S3
  const s3 = new AWS.S3();

  // Generate a unique key for the S3 object using a timestamp
  const timestamp = new Date().toISOString().replace(/:/g, '-'); // Use ISO timestamp without colons
  const s3Key = `financial-report-${timestamp}.pdf`;

  const s3Params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: s3Key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
  };
  await s3.upload(s3Params).promise();

  // Get the URL of the uploaded PDF in S3
  const s3ObjectUrl = `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;

  // Construct the response object
  const responseObject = {
    financialReport: s3ObjectUrl, // Actual URL of the generated report in S3
  };

  return {
    statusCode: 200,
    body: JSON.stringify(responseObject),
    headers: { 'Access-Control-Allow-Origin': '*' },
  };
};

// Function to generate the financial report (replace this with your actual report generation logic)
function generateFinancialReport(data) {
  // Replace this with your logic to generate the financial report in HTML
  // Return the HTML content of the generated report
  const htmlContent = `
  <html>
  <head>
    <title>Financial Report</title>
  </head>
  <body>
    <p>Hello, ${data.firstName} ${data.lastName}!</p>
    <p>Your financial report details:</p>
    <p>Credit Score: ${data.creditScore}</p>

    <!-- Red Flag Codes -->
    <p>Red Flag Codes:</p>
    <ul>
      ${data.redFlagCodes.map(flag => `<li>${flag.code}: ${flag.description}</li>`).join('')}
    </ul>

    <!-- Debts -->
    <p>Debts:</p>
    <ul>
      ${data.debts.map(debt => `
        <li>
          Account Number: ${debt.accountNumber},
          Company Name: ${debt.companyName},
          Individual Debt Amount: ${debt.individualDebtAmount},
          Debt Type: ${debt.debtType}
        </li>
      `).join('')}
    </ul>

    <p>Credit Utilization: ${data.creditUtilization}</p>

    <!-- Current Situation -->
    <p>Current Situation:</p>
    <ul>
      <li>Monthly Payment: ${data.currentSituation.monthlyPayment}</li>
      <li>Payoff Time: ${data.currentSituation.payoffTime}</li>
      <li>Interest Cost: ${data.currentSituation.interestCost}</li>
      <li>Total Cost: ${data.currentSituation.totalCost}</li>
    </ul>

    <!-- Debt Modification Program -->
    <p>Debt Modification Program:</p>
    <ul>
      <li>Monthly Payment: ${data.debtModificationProgram.monthlyPayment}</li>
      <li>Payoff Time: ${data.debtModificationProgram.payoffTime}</li>
      <li>Interest Cost: ${data.debtModificationProgram.interestCost}</li>
      <li>Total Cost: ${data.debtModificationProgram.totalCost}</li>
    </ul>
  </body>
</html>
  `;
  return htmlContent;
}

// Function to convert HTML to PDF using html-pdf library
async function convertHtmlToPdf(htmlContent) {
  return new Promise((resolve, reject) => {
    pdf.create(htmlContent).toBuffer((err, buffer) => {
      if (err) {
        reject(err);
      } else {
        resolve(buffer);
      }
    });
  });
}
