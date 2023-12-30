const axios = require('axios');

exports.handler = async (event, context) => {
  // Your existing code...
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

  try {
    // Make an API call to PDF service  
    const apiUrl = process.env.PDF_API_URL
    const apiResponse = await axios.post(apiUrl, {
      // Pass the necessary data for the report generation
      // Modify this object based on your requirements
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
    });

    // Handle the API response
    const generatedReportUrl = apiResponse.data.financialReport;
    console.log('Generated Report URL:', generatedReportUrl);

    // Construct the response object
    const responseObject = {
      financialReport: generatedReportUrl,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(responseObject),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  } catch (error) {
    console.error('Error making API call:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }
};

