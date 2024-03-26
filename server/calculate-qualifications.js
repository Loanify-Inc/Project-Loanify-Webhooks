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

  try {
    // Fetch credit report and debts in parallel
    const [creditReportResponse, debtResponse] = await Promise.all([
      performHttpRequest({
        hostname: BASE_URL,
        path: `/v1/contacts/${contactId}/get_credit_report`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'API-Key': API_KEY,
        },
      }),
      performHttpRequest({
        hostname: BASE_URL,
        path: `/v1/contacts/${contactId}/debts/enrolled`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'API-Key': API_KEY,
        },
      }),
    ]);

    // Parse the responses
    const creditReport = JSON.parse(creditReportResponse).response.report;
    const debts = JSON.parse(debtResponse).response;
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

    let totalUnsecuredDebt = 0;

    const debtDetails = debts
      .filter(debt => {
        // Check if the debt amount is greater than or equal to $500
        const isDebtAmountValid = parseFloat(debt.current_debt_amount) >= 500;

        // Extract the allowed debt type from the notes
        const debtType = allowedDebtTypes.find(type => debt.notes.includes(type));

        // If debtType is "Unsecured", add its amount to totalUnsecuredDebt
        if (debtType === "Unsecured" && isDebtAmountValid) {
          totalUnsecuredDebt += parseFloat(debt.current_debt_amount);
        }

        return isDebtAmountValid && !!debtType;
      })
      .map(debt => ({
        accountNumber: debt.og_account_num, // Use og_account_num as accountNumber
        companyName: debt.creditor.company_name, // Use creditor's company name as companyName
        individualDebtAmount: parseFloat(debt.current_debt_amount).toFixed(2),
        debtType: allowedDebtTypes.find(type => debt.notes.includes(type)),
      }));

    totalUnsecuredDebt = totalUnsecuredDebt.toFixed(2);
    const unsecuredDebtThresholdMet = parseFloat(totalUnsecuredDebt) > 10000 ? 'Yes' : 'No';

    const totalDebt = debtDetails.reduce((acc, debt) => acc + parseFloat(debt.individualDebtAmount), 0).toFixed(2);
    const status = totalDebt >= 10000 ? 'Qualified' : 'Not Qualified';

    // Check if total debt meets the threshold of $35,000
    const debtThresholdMet = parseFloat(totalDebt) >= 35000 ? 'Yes' : 'No';

    const creditUtilizationRaw = creditReport.revolvingCreditUtilization;
    const creditUtilizationPercentage = creditUtilizationRaw ? parseFloat(creditUtilizationRaw.replace('%', '')) : 'NaN';
    const creditUtilization = isNaN(creditUtilizationPercentage) ? 'NaN' : getCreditUtilizationCategory(creditUtilizationPercentage);
    const creditScore = creditReport.scoreModels.Equifax.score;

    function getCreditUtilizationCategory(percentage) {
      if (percentage > 100) {
        return 'Overutilization';
      } else if (percentage >= 91) {
        return 'Very High';
      } else if (percentage >= 61) {
        return 'High';
      } else if (percentage >= 31) {
        return 'Moderate';
      } else {
        return 'Low';
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        totalDebt: totalDebt,
        totalUnsecuredDebt: totalUnsecuredDebt,
        debtThresholdMet: debtThresholdMet,
        unsecuredDebtThresholdMet: unsecuredDebtThresholdMet,
        creditUtilization: creditUtilization,
        creditScore: creditScore,
        status: status,
        debts: debtDetails
      }),
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