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

  // Function to perform HTTP requests
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

  try {
    // Fetch credit report, contact information, and debts in parallel
    const [creditReportResponse, contactResponse, debtResponse] = await Promise.all([
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
        path: `/v1/contacts/${contactId}`,
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
      })
    ]);

    // Process responses
    const creditReport = JSON.parse(creditReportResponse).response.report;
    const contactInfo = JSON.parse(contactResponse).response;
    const debts = JSON.parse(debtResponse).response;

    // Process debts
    const allowedDebtTypes = [
      'CreditCard', 'Unsecured', 'CheckCreditOrLineOfCredit', 'Collection',
      'MedicalDebt', 'ChargeAccount', 'Recreational', 'NoteLoan', 'InstallmentLoan'
    ];

    const debtDetails = debts
      .filter(debt => parseFloat(debt.current_debt_amount) >= 500 &&
        allowedDebtTypes.some(type => debt.notes.includes(type)))
      .map(debt => ({
        accountNumber: debt.og_account_num,
        companyName: debt.creditor.company_name,
        individualDebtAmount: parseFloat(debt.current_debt_amount).toFixed(2),
        debtType: allowedDebtTypes.find(type => debt.notes.includes(type))
      }));

    const totalDebt = debtDetails
      .reduce((acc, debt) => acc + parseFloat(debt.individualDebtAmount), 0)
      .toFixed(2);

    // Ensure totalDebt is a number
    const totalDebtNumber = Number(totalDebt);
    if (isNaN(totalDebtNumber)) {
      throw new Error('Total debt is not a valid number');
    }

    // Current Situation Calculation (Assuming 24% interest rate, 10 year term)
    const annual_interest_rate = 0.24; // 24%
    const monthly_interest_rate = annual_interest_rate / 12;
    const payoff_time_months = 120; // 10 years
    const monthly_payment = totalDebt * (monthly_interest_rate * (1 + monthly_interest_rate) ** payoff_time_months) / ((1 + monthly_interest_rate) ** payoff_time_months - 1);
    const total_interest_cost = (monthly_payment * payoff_time_months) - totalDebt;
    const total_cost = totalDebt + total_interest_cost;

    // Ensure monthly_payment, total_interest_cost, and total_cost are numbers
    if (isNaN(monthly_payment) || isNaN(total_interest_cost) || isNaN(total_cost)) {
      throw new Error('Error in calculating current situation');
    }

    // Debt Modification Program Calculation (Half of total debt, no interest, payoff time adjusted to keep payment ~half of current situation)
    const modified_total_debt = totalDebt / 2;
    const modified_monthly_payment_approx = monthly_payment / 2;
    let modified_payoff_time_months = Math.min(Math.round(modified_total_debt / modified_monthly_payment_approx), 60);
    const exact_modified_monthly_payment = modified_total_debt / modified_payoff_time_months;

    // Ensure exact_modified_monthly_payment and modified_total_debt are numbers
    if (isNaN(exact_modified_monthly_payment) || isNaN(modified_total_debt)) {
      throw new Error('Error in calculating debt modification program');
    }

    // Define the payload object
    const payload = {
      firstName: contactInfo.first_name,
      lastName: contactInfo.last_name,
      preparedBy: "Kevin Kullins",
      creditScore: creditReport.scoreModels.Equifax.score,
      redFlagCodes: creditReport.scoreModels.Equifax.factors.map(factor => {
        const [code, description] = factor.split(" - ", 2);
        return { code: code.trim(), description: description.trim() };
      }),
      debts: debtDetails,
      creditUtilization: creditReport.revolvingCreditUtilization,
      totalDebt: totalDebtNumber.toFixed(2),
      currentSituation: {
        monthlyPayment: monthly_payment.toFixed(2),
        payoffTime: payoff_time_months,
        interestCost: total_interest_cost.toFixed(2),
        totalCost: total_cost.toFixed(2)
      },
      debtModificationProgram: {
        monthlyPayment: exact_modified_monthly_payment.toFixed(2),
        payoffTime: modified_payoff_time_months,
        interestCost: "0.00",
        totalCost: modified_total_debt.toFixed(2)
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
