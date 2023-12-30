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

  const API_PATH = `/v1/contacts/${contactId}/debts/enrolled`;
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

    // Parse the response and extract the required information
    const debts = JSON.parse(response).response;
    const allowedDebtTypes = [
      'CreditCard',
      'Unsecured',
      'CheckCreditOrLineOfCredit',
      'Collection',
      'MedicalDebt',
      'ChargeAccount',
      'Recreational',
      'NoteLoan',
      'InstallmentLoan',
    ];

    const debtDetails = debts
      .filter(debt => {
        // Check if the debt amount is greater than or equal to $500
        const isDebtAmountValid = parseFloat(debt.current_debt_amount) >= 500;

        // Extract the allowed debt type from the notes
        const debtType = allowedDebtTypes.find(type => debt.notes.includes(type));

        return isDebtAmountValid && !!debtType;
      })
      .map(debt => ({
        accountNumber: debt.og_account_num, // Use og_account_num as accountNumber
        companyName: debt.creditor.company_name, // Use creditor's company name as companyName
        individualDebtAmount: parseFloat(debt.current_debt_amount).toFixed(2),
        debtType: allowedDebtTypes.find(type => debt.notes.includes(type)),
      }));

    const totalDebt = debtDetails.reduce((acc, debt) => acc + parseFloat(debt.individualDebtAmount), 0).toFixed(2);

    // Determine the status based on the totalDebt amount
    const status = totalDebt >= 10000 ? 'Qualified' : 'Not Qualified';

    console.log('Calculated total debt:', totalDebt);
    console.log('Debt details:', debtDetails);

    return {
      statusCode: 200,
      body: JSON.stringify({ totalDebt: totalDebt, status: status, debts: debtDetails }),
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
}








