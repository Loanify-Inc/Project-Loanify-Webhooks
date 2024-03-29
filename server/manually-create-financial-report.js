const fs = require('fs');
const path = require('path');
const os = require('os');
const AWS = require('aws-sdk');
const ejs = require('ejs');
const https = require('https');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEYID,
  secretAccessKey: process.env.AWS_SECRET_ACCESSKEY,
  region: process.env.AWS_REGIONID,
});

const s3 = new AWS.S3();

// Function to determine the modified payoff time
function determinePayoffTime(totalDebt, numOfAccounts) {
  if (numOfAccounts === 1) return 24; // Max term of 24 months for a single account

  if (totalDebt >= 60000) return 60;
  if (totalDebt >= 35000) return 54;
  if (totalDebt >= 20000) return 48;
  if (totalDebt >= 15000) return 42;
  if (totalDebt >= 10000) return 36;

  return 36; // Default to 36 if below 10000 (or as per your business logic)
}

exports.handler = async (event, context) => {
  try {
    const API_KEY = process.env.API_KEY;
    const BASE_URL = 'api.forthcrm.com';

    // Extracting contactId from the event body
    const requestBody = JSON.parse(event.body);
    console.log("Body: " + event.body)
    const contactId = requestBody.contact_id;

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

    // Process all debts without filtering by debt type or amount
    const debtDetails = debts.map(debt => ({
      accountNumber: debt.og_account_num,
      companyName: debt.creditor.company_name,
      individualDebtAmount: parseFloat(debt.current_debt_amount).toFixed(2),
    }));

    const totalDebt = debtDetails
      .reduce((acc, debt) => acc + parseFloat(debt.individualDebtAmount), 0)
      .toFixed(2);

    // Ensure totalDebt is a number
    const totalDebtNumber = Number(totalDebt);
    if (isNaN(totalDebtNumber)) {
      throw new Error('Total debt is not a valid number');
    }

    // Calculate Total Monthly Payment based on the current debts
    const totalMonthlyPayment = debts
      .reduce((acc, debt) => acc + parseFloat(debt.current_payment), 0)
      .toFixed(2);

    // Ensure totalMonthlyPayment is a number
    const totalMonthlyPaymentNumber = Number(totalMonthlyPayment);
    if (isNaN(totalMonthlyPaymentNumber)) {
      throw new Error('Total monthly payment is not a valid number');
    }

    // Current Situation Calculation
    const payoff_time_months = 120; // 10 years

    // Recalculate total interest cost and total cost based on the final monthly payment
    let total_interest_cost, total_cost;
    total_interest_cost = totalMonthlyPaymentNumber * payoff_time_months;
    total_cost = totalDebtNumber + total_interest_cost;

    // Check for NaN in calculated values
    if (isNaN(totalMonthlyPaymentNumber) || isNaN(total_interest_cost) || isNaN(total_cost)) {
      throw new Error('Calculated value is NaN in current situation');
    }

    // Determine the number of accounts
    const numOfAccounts = debtDetails.length;

    // Use the determinePayoffTime function to get the modified payoff time
    const modified_payoff_time_months = determinePayoffTime(totalDebtNumber, numOfAccounts);

    // Debt Modification Program Calculation with 25% reduction and additional fees
    const modified_total_debt = (totalDebtNumber * 0.75) + 10.95 + (10.95 * (modified_payoff_time_months - 1));

    // Calculate the exact modified monthly payment
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
        monthlyPayment: totalMonthlyPaymentNumber.toFixed(2),
        payoffTime: payoff_time_months,
        interestCost: total_interest_cost.toFixed(2),
        totalCost: total_cost.toFixed(2)
      },
      debtModificationProgram: {
        monthlyPayment: exact_modified_monthly_payment.toFixed(2),
        payoffTime: modified_payoff_time_months,
        totalCost: modified_total_debt.toFixed(2),
        totalSavings: (total_cost - modified_total_debt).toFixed(2)
      }
    };

    // Define your HTML template (Can be externalized as well)
    const htmlTemplate = `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
          <title>Loanify</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.4.0/jspdf.umd.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.3.2/html2canvas.min.js"></script>
          
        </head>
        <body style="margin:0;background-color:#cccccc;font-family:'Poppins', sans-serif;color:#222D38;">
        <div id="content" style="width: auto; height: auto;">
          <center style="width:100%;table-layout:fixed;background-color:#cccccc;">
            <table width="100%" style="background-color:#ffffff;margin:0 auto;width:100%;max-width:500px;border-spacing:0;padding:10px 0px;">
              <!--=======================Row=======================-->
              <tr>
                <td style="padding:20px;">
                  <table style="border-spacing:0;">
                    <tr>
                      <td style="padding:0;">
                        <h2 style="font-size:16px;font-weight:700;color:#1DA1F2;margin:0 !important;">LOANIFY</h2>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td  style='padding:0;background-color:#1DA1F2;background-image:url("https://i.ibb.co/hLMgJ79/sending-message-loanify.png");background-repeat:no-repeat;background-position:100% 50%;color:#ffffff;padding:20px;font-size:16px;'>
                  Prepared For- <span style="font-weight:600;"><%= payload.firstName %> <%= payload.lastName %></span><br>
                  By- <span style="font-weight:600;"><%= payload.preparedBy %>, Financial Consultant, Loanify</span>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="padding:20px;">
                  <table style="border-spacing:0;padding:30px;background-color:#F5F7FA;border-radius:10px;">
                    <tr>
                      <td style="padding:0;">
                        <h1 style="font-size:20px;line-height:32px;font-weight:600;margin-bottom:20px;">Dear <%= payload.firstName %>,</h1>
                        <p style="text-align:left;margin-bottom:30px;">
                          The following is a detailed analysis of your financial profile. This report identifies important information about your current financial and credit situation such as;
                        </p>
                        <ul style="margin-top:30px;margin-bottom:30px;">
                          <li style="margin-bottom:10px;">Length of repayment and total interest paid based on current debt load.</li>
                          <li style="margin-bottom:10px;">Red flag codes on your credit report which negatively impact overall credit worthiness.</li>
                          <li style="margin-bottom:10px;">Utilization rate of unsecured accounts reported by creditors.</li>
                        </ul>
                        <p style="text-align:left;margin-bottom:30px;">
                          In addition to this important information, you are being provided an outline of our recommended solution based on your personal overall financial and credit situation. This plan will not only solidify your finances but re-establish you as a creditworthy consumer.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="padding:20px;">
                  <table style="border-spacing:0;padding:15px;background-color:#F5F7FA;border-radius:10px; width: 100%;">
                    <tr>
                      <td style="padding:0;">
                        <h1 style="font-size:24px; font-weight:700;margin: 0; color: #1DA1F2;">Your Fico Score</h1>
                      </td>
                    </tr>
                  </table>


                  <div style="width: 100%; margin-top: 20px; display: flex; gap: 10px;">
                    <div style="width: 100%; padding:20px 10px; border: 1px solid #1DA1F2; border-radius: 8px; display: flex; justify-content: center; align-items: center;">
                      <table style="width: 100%; max-width: 200px;" cellspacing="0">
                        <tr>
                          <td colspan="5" style="font-size:14px;color:#787878; line-height: 150%;" align="center">
                            Your Credit Score is:
                          </td>
                        </tr>
                        <tr>
                          <td colspan="5" style="font-size:40px; font-weight: 700; color:#1E1E1E; line-height: 150%;" align="center">
                            <%= payload.creditScore %>
                          </td>
                        </tr>
                        <tr>
                          <td width="20%" style="color: #CAEAFF; font-size: 7px; font-weight: 500;">250</td>
                          <td width="20%"></td>
                          <td width="20%"></td>
                          <td width="20%"></td>
                          <td width="20%" style="color: #1DA1F2; font-size: 7px; font-weight: 500;" align="right">800</td>
                        </tr>
                        <tr height="8">
                          <td width="20%" style="background-color: #E1F4FF;"></td>
                          <td width="20%" style="background-color: #C2E8FF;"></td>
                          <td width="20%" style="background-color: #9DDAFF;"></td>
                          <td width="20%" style="background-color: #67C5FF;"></td>
                          <td width="20%" style="background-color: #1DA1F2;"></td>
                        </tr>
                      </table>
                    </div>


                    <div style="width: 100%; padding:20px 10px; border: 1px solid #1DA1F2; border-radius: 8px; display: flex; justify-content: center; align-items: center;">
                      <table style="width: 100%; max-width: 200px; font-size: 14px; color: #787878; line-height: 150%;" cellspacing="0">
                        <tr>
                          <td>Exceptional:</td>
                          <td style="border-right: 5px solid #1DA1F2; text-align: right; padding-right: 8px;">800 -  850</td>
                        </tr>
                        <tr>
                          <td>Very Good:</td>
                          <td style="border-right: 5px solid #67C5FF; text-align: right; padding-right: 8px;">740  -  799</td>
                        </tr>
                        <tr>
                          <td>Good:</td>
                          <td style="border-right: 5px solid #9DDAFF; text-align: right; padding-right: 8px;">670  -  739</td>
                        </tr>
                        <tr>
                          <td>Fair:</td>
                          <td style="border-right: 5px solid #C2E8FF; text-align: right; padding-right: 8px;">580 -  669</td>
                        </tr>
                        <tr>
                          <td>Poor:</td>
                          <td style="border-right: 5px solid #E1F4FF; text-align: right; padding-right: 8px;">300 -  579</td>
                        </tr>
                      </table>
                    </div>
                  </div>
                </td>
              </tr>


              <!--=======================Row=======================-->
              <tr>
                <td style="padding:20px;">
                  <table width="100%" style="border-spacing:0;">
                    <tr>
                      <td colspan="3" style="background-color: #F5F7FA; color: #787878; font-size: 13px; font-weight: 600; border-radius: 6px; text-align: center; padding: 10px;">
                        Reg Flag Codes Negatively Impact Credit Worthiness
                      </td>
                    </tr>
                  </table>
                  <table width="100%" style="border-spacing: 0 8px;">
                    <tr>
                      <td style="width: 25%; background-color: #1DA1F2; color: #FFFFFF; font-size: 13px; font-weight: 600; border-bottom-left-radius: 6px; border-top-left-radius: 6px; text-align: center; padding: 10px; border-right: 1px solid #FFFFFF;">
                        Flag
                      </td>
                      <td style="width: 25%; background-color: #1DA1F2; color: #FFFFFF; font-size: 13px; font-weight: 600; text-align: center; padding: 10px; border-right: 1px solid #FFFFFF;">
                        Code
                      </td>
                      <td style="width: 50%; background-color: #1DA1F2; color: #FFFFFF; font-size: 13px; font-weight: 600; border-bottom-right-radius: 6px; border-top-right-radius: 6px; padding: 10px;">
                        Description
                      </td>
                    </tr>
                    <% payload.redFlagCodes.forEach(function(code, index) { %>
                      <tr>
                        <td style="background-color: #F5F7FA; color: #F21D1D; font-size: 13px; font-weight: 600; border-bottom-left-radius: 6px; border-top-left-radius: 6px; text-align: center; padding: 10px; border-right: 1px solid #E3E3E3;">
                          <img src="https://i.ibb.co/jR8fVVh/flag.png" alt="flag" border="0" style="border:0;max-width:100%;">
                        </td>
                        <td style="background-color: #F5F7FA; color: #F21D1D; font-size: 13px; text-align: center; padding: 10px; border-right: 1px solid #E3E3E3;">
                          <%= code.code %>
                        </td>
                        <td style="background-color: #F5F7FA; color: #787878; font-size: 13px; border-bottom-right-radius: 6px; border-top-right-radius: 6px; padding: 10px;">
                          <%= code.description %>
                        </td>
                      </tr>
                    <% }); %>

                  </table>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="padding:20px;">
                  <table style="border-spacing:0;width: 100%;">
                    <tr>
                      <td style="background-color: #E8F6FE; color: #1DA1F2; font-size: 18px; font-weight: 700; border-bottom-left-radius: 6px; border-top-left-radius: 6px; padding: 15px 11px;">
                        Your Creditors
                      </td>
                      <td style="background-color: #E8F6FE; color: #1DA1F2; font-size: 18px; font-weight: 700; border-bottom-right-radius: 6px; border-top-right-radius: 6px; padding: 15px 11px;">
                        Balances
                      </td>
                    </tr>
                    <% payload.debts.forEach(function(accountNumber, index) { %>
                    <tr>
                      <td style="color: #787878; font-size: 14px; font-weight: 700; padding: 20px 11px; border-bottom: 1px solid #E3E3E3;">
                        <%= accountNumber.companyName %>
                      </td>
                      <td style="color: #787878; font-size: 14px; font-weight: 700; padding: 15px 11px; border-bottom: 1px solid #E3E3E3;">
                        <%= accountNumber.individualDebtAmount %>
                      </td>
                    </tr>
                    <% }); %>
                    <tr>
                      <td style="color: #1DA1F2; font-size: 14px; font-weight: 700; padding: 20px 11px; ;">
                        TOTAL
                      </td>
                      <td style="color: #1DA1F2; font-size: 14px; font-weight: 700; padding: 15px 11px; ;">
                        <%= payload.totalDebt %>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="padding:20px;">
                  <table width="100%" style="border-spacing:0;padding:20px;background-color:#F5F7FA;border-radius:10px;">
                    <tr>
                      <td align="center" width="40%" style="padding:0;position: relative; border-right: 1px solid #1E1E1E;">
                        <div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: #1E1E1E; font-weight: 700; font-size: 25px; flex-direction: column;">
                          <div><%= payload.creditUtilization %></div>
                        <div style="font-size: 8px; color: #1E1E1E;">Your Utilization Rate</div>
                      </div>
                      </td>
                      <td align="center" style="padding:0;text-align: center; font-size: 18px; color: #1E1E1E; line-height: 100%;">
                        <span style="margin-right: 10px; font-size: 10px; background-color: #1DA1F2; padding: 0px 5px;">&nbsp;</span>Total Credit Utilized
                        <div style="font-weight: 700; font-size: 30px; color: #1E1E1E; padding-top: 15px;"><%= payload.totalDebt %></div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="padding:20px;">
                  <table style="border-spacing:0;padding:20px;background-color:#F5F7FA;border-radius:10px;">
                    <tr>
                      <td style="padding:0;">
                        <h1 style="font-size:20px;line-height:32px;font-weight:600;margin-bottom:20px;">Underwriting Determination</h1>
                        <p style="text-align:left;margin-bottom:30px;">
                          The applicant meets the eligibility requirements for a non-credit-based option. This option, which has federal laws in place for your overall protection and success, consolidates all your debts into one lower payment.
                        </p>
                        <h1 style="font-size:20px;line-height:32px;font-weight:600;margin-bottom:20px;">Utilization Rates and Why They Matter</h1>
                        <p style="text-align:left;margin-bottom:30px;">
                          The ratio of your available credit compared to the balance owed determines your utilization rate. Your current utilization rate is <span style="font-weight:700;color:#0B72F1;"><%= payload.creditUtilization %></span>. Lenders view any ratio over 30% to be high and as a result the consumer to be a potential lending risk.<br/><br/>
                          The utilization rate is by far the most influential factor in determining your credit score. A high credit utilization rate drastically reduces your creditworthiness and creditors can lower your credit limit, increase your interest rates and/or close your account, even in spite of excellent payment history. Prolonged periods of high credit utilization rates negatively impacts your credit score and increases the likelihood of future credit applications being declined.
                        </p>
                        <h1 style="font-size:20px;line-height:32px;font-weight:600;margin-bottom:20px;">Solution</h1>
                        <p style="text-align:left;margin-bottom:30px;">
                          Underwriting has confirmed you are approved and qualified for a non-credit based consolidation option. Commonly referred to as the Federal Trade Commission Compliant Debt Resolution Plan, this complies 100% with the strict rules dictated by the <span style="font-weight:700;">Federal Trade Commission (FTC)</span> and is overseen by the <span style="font-weight:700;">American Fair Credit Council (AFCC)</span> for consumer protection and streamlined cooperation with creditors. As of the most recent quarterly reporting, there is over $89.3 Billion in consumer debt currently under management with over 4.2 Million consumers enrolled.<br/><br/>
                          This plan will you provide you with one much more affordable monthly payment and all future interest is eliminated entirely. Once the compounding interest is eliminated, debts can be paid off in an average of 3.5 years (versus 30+ years under the clients existing terms).<br/><br/>
                          Most importantly, this program helps consumers avoid the long-term catastrophic effects of more extreme consolidation options such as Consumer Credit Counseling Services and/or Chapter 7 or 13 Bankruptcy filings. The program itself is <span style="font-weight:700;">NOT</span> reported to credit bureaus so all reporting will show you paid the debts and not a 3rd party.<br/><br/>
                          As outstanding balances are paid down and the utilization rate decreases on the client's credit report, the FICO score and the client's credit worthiness rapidly improve so that traditional lending is more attainable in the near future.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="padding:20px;">
                  <table align="center" style="border-spacing:0;">
                    <tr>
                      <td style="padding:0;">
                        <h3 style="font-size: 18px; font-weight: 600; color: #1E1E1E; text-align: center;">Comparing your options:</h3>
                        <p style="margin-bottom:30px;padding: 0px 40px; color: #787878; font-size: 18px; text-align: center;">
                          Below is a side by side comparison of your current situation and the Debt Resolution Plan you are approved for.
                        </p>
                      </td>
                    </tr>
                  </table>
                  <table align="center" style="border-spacing:0;">
                    <tr>
                      <td style="text-align: center; background-color: #E8F6FE; border-radius: 10px; padding: 20px 40px; font-size: 14px; color: #787878;">
                        Total Debt:<br/>
                        <span style="font-weight: 600; font-size: 34px; color: #1DA1F2;"><%= payload.totalDebt %></span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="padding: 0px 20px;">
                  <table style="border-spacing:0;background-color:#F5F7FA;border-radius:10px;width: 100%; font-size: 21px; color: #2a2a2a; font-weight: 500; padding: 20px 0px;">
                    <tr>
                      <td width="50%" align="center" style="padding:0;border-right: 1px solid #E3E3E3;">
                        Current Situation
                      </td>
                      <td width="50%" align="center" style="padding:0;">
                        Resolution Program
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="padding: 0;">
                  <table align="center" style="border-spacing:0;margin-top: 20px; width: 90%; font-size: 12px; color: #787878;">
                    <tr>
                      <td width="50%" align="center" style="padding: 10px 20px;">
                        <table width="100%" style="border-spacing:0;border-radius: 10px; padding: 15px; background-color: #F5F7FA;">
                          <tr>
                            <td align="center" style="padding:0;">
                              MONTHLY PAYMENT:<br/>
                              <span style="font-size: 24px; font-weight: 600; color: #F21D1D;">$<%= payload.currentSituation.monthlyPayment %></span>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td width="50%" align="center" style="padding: 10px 20px;">
                        <table width="100%" style="border-spacing:0;border-radius: 10px; padding: 15px; background-color: #F5F7FA;">
                          <tr>
                            <td align="center" style="padding:0;">
                              MONTHLY PAYMENT:<br/>
                              <span style="font-size: 24px; font-weight: 600; color: #1DA1F2;">$<%= payload.debtModificationProgram.monthlyPayment %></span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="padding: 0;">
                  <table align="center" style="border-spacing:0;width: 90%; font-size: 12px; color: #787878;">
                    <tr>
                      <td width="50%" align="center" style="padding: 10px 20px;">
                        <table width="100%" style="border-spacing:0;border-radius: 10px; padding: 15px; background-color: #F5F7FA;">
                          <tr>
                            <td align="center" style="padding:0;">
                              PAYOFF TIME:<br/>
                              <span style="font-size: 24px; font-weight: 600; color: #F21D1D;"><%= payload.currentSituation.payoffTime %>/ Months
                              </span>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td width="50%" align="center" style="padding: 10px 20px;">
                        <table width="100%" style="border-spacing:0;border-radius: 10px; padding: 15px; background-color: #F5F7FA;">
                          <tr>
                            <td align="center" style="padding:0;">
                              PAYOFF TIME:<br/>
                              <span style="font-size: 24px; font-weight: 600; color: #1DA1F2;"><%= payload.debtModificationProgram.payoffTime %>/ Months
                              </span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="padding: 0;">
                  <table align="center" style="border-spacing:0;width: 90%; font-size: 12px; color: #787878;">
                    <tr>
                      <td width="50%" align="center" style="padding: 10px 20px;">
                        <table width="100%" style="border-spacing:0;border-radius: 10px; padding: 15px; background-color: #F5F7FA;">
                          <tr>
                            <td align="center" style="padding:0;">
                                AMOUNT PAID:<br/>
                              <span style="font-size: 24px; font-weight: 600; color: #F21D1D;">$<%= payload.currentSituation.totalCost %>
                              </span><br/>
                              <span style="font-size: 10px;">($<%= payload.currentSituation.interestCost %> in Interest)</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td width="50%" align="center" style="padding: 10px 20px;">
                        <table width="100%" style="border-spacing:0;border-radius: 10px; padding: 15px; background-color: #F5F7FA;">
                          <tr>
                            <td align="center" style="padding:0;">
                                AMOUNT PAID:<br/>
                              <span style="font-size: 24px; font-weight: 600; color: #1DA1F2;">$<%= payload.debtModificationProgram.totalCost %>
                              </span><br/>
                              <span style="font-size: 10px;">(including fees)</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="padding: 0;">
                  <table align="center" style="border-spacing:0;width: 90%; font-size: 12px; color: #787878;">
                    <tr>
                      <td width="50%" align="center" style="padding: 10px 20px;">
                        <table width="100%" style="border-spacing:0;border-radius: 10px; padding: 15px; background-color: #F5F7FA;">
                          <tr>
                            <td align="center" style="padding:0;">
                              AMOUNT SAVED:<br/>
                              <span style="font-size: 24px; font-weight: 600; color: #F21D1D;">$0
                              </span>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td width="50%" align="center" style="padding: 10px 20px;">
                        <table width="100%" style="border-spacing:0;border-radius: 10px; padding: 15px; background-color: #F5F7FA;">
                          <tr>
                            <td align="center" style="padding:0;">
                                AMOUNT SAVED:<br/>
                              <span style="font-size: 24px; font-weight: 600; color: #11C76F;">$<%= payload.debtModificationProgram.totalSavings %>
                              </span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="padding:20px;">
                  <table style="border-spacing:0;padding:20px;background-color:#F5F7FA;border-radius:10px;">
                    <tr>
                      <td style="padding:0;">
                        <h1 style="font-size:20px;line-height:32px;font-weight:600;margin-bottom:20px;">The Benefit</h1>
                        <p style="text-align:left;margin-bottom:30px;">
                          Loanify carries an "A+" rating with the Better Business Bureau. With over $20million in resolved debt and currently $7 million under our management, Loanify Financial has a combined experience of 20 years.
                        </p>
                        <h1 style="font-size:20px;line-height:32px;font-weight:600;margin-bottom:20px;">Program Details Summary</h1>
                        <ul style="margin-top:30px;margin-bottom:30px;">
                          <li style="margin-bottom:10px;">No upfront costs or fees</li>
                          <li style="margin-bottom:10px;">No prepayment penalty</li>
                          <li style="margin-bottom:10px;">Monthly payments are deposited into a FDIC insured account.</li>
                          <li style="margin-bottom:10px;">Balances eliminated in 24-48 months</li>
                        </ul>
                        <h1 style="font-size:20px;line-height:32px;font-weight:600;margin-bottom:20px;">Recent Approvals</h1>
                        <ul style="margin-top:30px;margin-bottom:30px;">
                          <li style="margin-bottom:10px;">Marcy CXXXXXXX was just approved for 0% interest on a debt of $24,586 for a Wells Fargo account.</li>
                          <li style="margin-bottom:10px;">Patty GXXXXX was just approved for 0% interest on a debt of
                            $12,052 for a Bank of America account.</li>
                          <li style="margin-bottom:10px;">Mike SXXXXXX was just approved for 0% interest on a debt of $2,058 for a Chase account.</li>
                        </ul>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="padding:20px;color: #1DA1F2; font-size: 18px; font-weight: 600; text-align: center;">
                  Testimonials
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="color: #787878; font-size: 16px; text-align: center; padding: 20px;">
                  <table width="100%" style="border-spacing:0;padding: 20px 30px; border-radius: 12px; box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 24px;">
                    <tr>
                      <td style="padding:0;">
                        Donald- Dallas, Texas
                      </td>
                    </tr>
                    <tr>
                      <td align="left" style="padding:0;">
                        <img src="https://i.ibb.co/WxTGQx3/quotation-mark-open.png" alt="quotation-mark-open" border="0" style="border:0;max-width:100%;">
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 0 40px;">
                        I was keeping up with my monthly payments but not seeing our balances go down. This went on for 5 years...I stopped procrastinating and made a change. I made the best decision by choosing Loanify Financial to help me with my finances. They set up a payment plan that I could afford and now I am on my way to actually paying off my debt!
                      </td>
                    </tr>
                    <tr>
                      <td align="right" style="padding:0;">
                        <img src="https://i.ibb.co/d4TCmQp/quotation-mark-close.png" alt="quotation-mark-close" border="0" style="border:0;max-width:100%;margin-top: -30px;">
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="color: #787878; font-size: 16px; text-align: center; padding: 20px;">
                  <table width="100%" style="border-spacing:0;padding: 20px 30px; border-radius: 12px; box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 24px;">
                    <tr>
                      <td style="padding:0;">
                        Barbra-Garden Grove, California
                      </td>
                    </tr>
                    <tr>
                      <td align="left" style="padding:0;">
                        <img src="https://i.ibb.co/WxTGQx3/quotation-mark-open.png" alt="quotation-mark-open" border="0" style="border:0;max-width:100%;">
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 0 40px;">
                        I am so pleased with my decision to go with Loanify. The staff is very kind and understanding very helpful and pleasant to work with.
                      </td>
                    </tr>
                    <tr>
                      <td align="right" style="padding:0;">
                        <img src="https://i.ibb.co/d4TCmQp/quotation-mark-close.png" alt="quotation-mark-close" border="0" style="border:0;max-width:100%;margin-top: -30px;">
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="color: #787878; font-size: 16px; text-align: center; padding: 20px;">
                  <table width="100%" style="border-spacing:0;padding: 20px 30px; border-radius: 12px; box-shadow: rgba(149, 157, 165, 0.2) 0px 8px 24px;">
                    <tr>
                      <td style="padding:0;">
                        Karen- Boston, Massachusetts
                      </td>
                    </tr>
                    <tr>
                      <td align="left" style="padding:0;">
                        <img src="https://i.ibb.co/WxTGQx3/quotation-mark-open.png" alt="quotation-mark-open" border="0" style="border:0;max-width:100%;">
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 0 40px;">
                        One of the best decisions I've ever made. My only regret is I'd wish I had done this sooner!
                      </td>
                    </tr>
                    <tr>
                      <td align="right" style="padding:0;">
                        <img src="https://i.ibb.co/d4TCmQp/quotation-mark-close.png" alt="quotation-mark-close" border="0" style="border:0;max-width:100%;margin-top: -30px;">
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!--=======================Row=======================-->
              <tr>
                <td style="padding:0;">
                  <table style="border-spacing:0;width: 100%; margin-top: 60px; color: #FFFFFF; background-color: #1DA1F2; font-size: 16px; font-weight: 700; padding: 20px;">
                    <tr>
                      <td align="center" style="padding:0;">
                        LOANIFY
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </center>
          </div>
          <!--Adding button to download the PDF-->
          <button onclick="generatePDF()" style="position: fixed; right: 20%; top: 10px;">Download PDF</button>
          
              
          <script>
            //Adding page onload download the PDF        
            window.onload = async function() {
                const content = document.getElementById('content');
                const canvas = await html2canvas(content);
                const imgData = canvas.toDataURL('image/png');

                // Get the dimensions of the rendered content
                const contentWidth = canvas.width;
                const contentHeight = canvas.height;

                // Create a PDF with the same dimensions (or scaled dimensions)
                const pdf = new jspdf.jsPDF({
                    orientation: 'portrait',
                    unit: 'px',
                    format: [contentWidth, contentHeight]
                });

                // Add the image to the PDF at full size
                pdf.addImage(imgData, 'PNG', 0, 0, contentWidth, contentHeight);

                // Generate file name from URL or other data
                const filename = 'PDF_' + new Date().toISOString() + '.pdf';

                // Save the PDF
                pdf.save(filename);
            }
            </script>

            
            <script>
                //Adding download button the PDF 
                async function generatePDF() {
                    const content = document.getElementById('content');
                    const canvas = await html2canvas(content);
                    const imgData = canvas.toDataURL('image/png');

                    // Get the dimensions of the rendered content
                    const contentWidth = canvas.width;
                    const contentHeight = canvas.height;

                    // Create a PDF with the same dimensions (or scaled dimensions)
                    const pdf = new jspdf.jsPDF({
                        orientation: 'portrait',
                        unit: 'px',
                        format: [contentWidth, contentHeight]
                    });

                  // Add the image to the PDF at full size
                    pdf.addImage(imgData, 'PNG', 0, 0, contentWidth, contentHeight);

                  // Generate file name from URL or other data
                    const filename = 'PDF_' + new Date().toISOString() + '.pdf';

                  // Save the PDF
                    pdf.save(filename);
                }
            </script>
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

    // Define the function to perform HTTP POST requests
    function performHttpPostRequest(options, body) {
      return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject({ statusCode: res.statusCode, message: data });
            }
          });
        });

        req.on('error', (error) => {
          reject({ statusCode: 500, message: error.message });
        });

        // Write the JSON body and end the request
        req.write(JSON.stringify(body));
        req.end();
      });
    }

    const slackConfigMap = {
      '8735070': { // Kevin
        userId: '<@U065V4AE5KJ>',
        webhookPath: '/services/T0607C1F0GP/B06PQ8AELMR/26hCLEbwAM2Kn9ZK4ajx9clI',
      },
      '8886206': { // Alex
        userId: '<@U06PCRVCAJC>',
        webhookPath: '/services/T0607C1F0GP/B06QZ2X58BX/FjcDfHlWOYDpZqQPTiuPuslU',
      }
    };

    const slackConfig = slackConfigMap[contactInfo.assigned_to]

    const slackWebhookOptions = {
      hostname: 'hooks.slack.com',
      path: slackConfig.webhookPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const slackMessage = {
      text: `${slackConfig.userId} Here is the updated report you requested for ${payload.firstName} ${payload.lastName}: ${uploadResult.Location}`
    };

    try {
      // Await the POST request to send the message to Slack
      await performHttpPostRequest(slackWebhookOptions, slackMessage);
      console.log('Slack message sent successfully.');
    } catch (error) {
      console.error('Error sending Slack message:', error);
    }

    // Prepare the response object
    const response = {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'File uploaded to S3 successfully', url: uploadResult.Location }),
    };

    // Log the response to the console
    console.log('Response:', response);

    // Return the response
    return response;

  } catch (error) {
    console.error('Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};