const https = require('https');

exports.handler = async (event, context) => {
  const API_KEY = process.env.API_KEY;
  const BASE_URL = 'api.forthcrm.com';
  const contactId = JSON.parse(event.body).contact_id;

  if (!contactId) {
    console.error('Contact ID is required');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Contact ID is required' }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }

  const API_PATH = `/v1/contacts/${contactId}/get_credit_report`;
  const options = {
    hostname: BASE_URL,
    path: API_PATH,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'API-Key': API_KEY,
    },
  };

  try {
    const response = await performHttpRequest(options);
    const creditReport = JSON.parse(response).response.report;

    // Define the payload object with data from the response
    const payload = {
      // Assuming other fields like firstName, lastName, etc. are static or from another source
      firstName: "Boomer",
      lastName: "Baker",
      preparedBy: "Kevin Kullins",
      creditScore: creditReport.scoreModels.Equifax.score,
      redFlagCodes: creditReport.scoreModels.Equifax.factors.map(factor => {
        const [code, description] = factor.split(" - ", 2);
        return { code: code.trim(), description: description.trim() };
      }),
      debts: "debtDetails", // from your existing code
      creditUtilization: creditReport.revolvingCreditUtilization,
      totalDebt: "totalDebt", // from your existing code
      currentSituation: {
        monthlyPayment: "970",
        payoffTime: "148",
        interestCost: "128,482",
        totalCost: "161,172"
      },
      debtModificationProgram: {
        monthlyPayment: "562",
        payoffTime: "42",
        interestCost: "0",
        totalCost: "23,591"
      }
    };

    return {
      statusCode: 200,
      body: JSON.stringify({ payload }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  } catch (error) {
    console.error('Error:', error.message);
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({ error: error.message }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }
};

function performHttpRequest(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject({ statusCode: res.statusCode, message: data });
        }
      });
    });

    req.on('error', (error) => {
      reject({ statusCode: 500, message: error.message });
    });

    req.end();
  });
};

