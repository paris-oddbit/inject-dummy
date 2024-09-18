// generateCard.js
require('dotenv').config();
const axios = require('axios');
const https = require('https');
const { loginAndGetSessionId } = require('./login');

// Create an https agent that ignores self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Disable SSL certificate validation
});

// Array of card types with id, name, type, and mode
const cardTypes = [
  { id: '0', name: 'CSN', type: '1', mode: 'C' },
  { id: '1', name: 'CSN Wiegand', type: '10', mode: 'C' },
  { id: '2', name: 'Secure Credential Card (Card)', type: '2', mode: 'S' },
  { id: '3', name: 'Access on Card (Card)', type: '3', mode: 'A' },
  { id: '4', name: 'CSN Mobile', type: '4', mode: 'M' },
  { id: '5', name: 'Wiegand Mobile', type: '5', mode: 'M' },
  { id: '6', name: 'QR', type: '6', mode: 'Q' },
  { id: '7', name: 'BioStar 2 QR', type: '7', mode: 'Q' },
  { id: '8', name: 'Custom Smart Card', type: '13', mode: 'U' },
  {
    id: '9',
    name: 'Access on Card (Template on Mobile)',
    type: '14',
    mode: 'T',
  },
  {
    id: '10',
    name: 'Secure Credential Card (Template on Mobile)',
    type: '15',
    mode: 'T',
  },
];

// Function to generate card collection
// function generateCardCollection(totalCards, cardsPerType) {
function generateCardCollection(cardsPerType) {
  let cardCollection = { CardCollection: { rows: [] } };
  let cardIdCounter = 1000100; // Start card ID
  let wiegandFormatToggle = 1; // This will toggle between 1 and 4 for wiegand_format_id

  cardTypes.forEach((cardType) => {
    let count = cardsPerType[cardType.id] || 0; // Number of cards to generate for this type
    for (let i = 0; i < count; i++) {
      let cardData = {
        card_id: (cardIdCounter++).toString(),
        card_type: { id: cardType.id, type: cardType.type },
      };

      // Special case for card_type.id == 1 (CSN Wiegand)
      if (cardType.id === '1') {
        cardData.wiegand_format_id = { id: wiegandFormatToggle.toString() };
        // Toggle between 1 and 4 for wiegand_format_id
        wiegandFormatToggle = wiegandFormatToggle === 1 ? 4 : 1;
      }

      cardCollection.CardCollection.rows.push(cardData);
    }
  });

  return cardCollection;
}

// Function to send generated card collection to the API with the session ID
async function sendCardCollection(sessionId) {
  const apiUrl = `${process.env.BASE_URL}${process.env.CARD_GENERATE_ENDPOINT}`;

  // const totalCards = 10; // Total number of cards
  const cardsPerType = {
    0: 2, // 2 cards of card_type id = 0
    1: 2, // 2 cards of card_type id = 1
    2: 2, // 2 cards of card_type id = 2
    3: 2, // 2 cards of card_type id = 3
    4: 2, // 2 cards of card_type id = 4
    5: 2, // 2 cards of card_type id = 5
    6: 2, // 2 cards of card_type id = 6
    // 7: 2, // 2 cards of card_type id = 7 //! NOT WORKING
    8: 2, // 2 cards of card_type id = 8
    9: 2, // 2 cards of card_type id = 9
    10: 2, // 2 cards of card_type id = 10
  };

  // const cardCollection = generateCardCollection(totalCards, cardsPerType);
  const cardCollection = generateCardCollection(cardsPerType);
  // console.log('Card generation data:', JSON.stringify(cardCollection, null, 2));

  try {
    const response = await axios.post(apiUrl, cardCollection, {
      headers: {
        'Content-Type': 'application/json',
        'bs-session-id': sessionId,
      },
      httpsAgent, // Attach the custom https agent to bypass SSL validation
    });
    console.log(
      'Card generation response:',
      JSON.stringify(response.data, null, 2)
    );
  } catch (error) {
    console.error('Error sending card generation request:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
  }
}

// Main function to handle login and card generation
async function createCards() {
  try {
    // Step 1: Login and get session ID
    const sessionId = await loginAndGetSessionId();

    // Step 2: Send the card collection with session ID
    await sendCardCollection(sessionId);
  } catch (error) {
    console.error('Error in main process:', error.message);
  }
}

// Run the main process
createCards();
