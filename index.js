'use strict';

// Allow this module to be reloaded by hotswap when changed
// ( For alexa-app server )
module.change_code = 1;

const Alexa = require('alexa-app'),
      app   = new Alexa.app('quizme'),
      rp    = require('request-promise');


// On invocation
app.launch(function (req, res) {
  const prompt = `What would you like to study?`;

  if (!req.data.session.user.accessToken) {
    res.linkAccount();
  }

  res.say(prompt).reprompt(prompt).shouldEndSession(false);
});

// Choose quiz
app.intent('PickQuiz', { "slots": {"quizName": "QUIZZES"}, "utterances": ["{Quiz} {-|quizName}"] }, function (req, res) {
  const quizName = req.slot('quizName').toLowerCase(),
        options  = {
          uri: `https://alexaquiz.herokuapp.com/alexa/${quizName}`,
          json: true
        };

  rp(options).then(quiz => {
    const prompt = `${quiz.quiz[0].q}.`;
    quiz.currentQ = 0;
    quiz.results = [];

    res.session('quiz', quiz);
    res.say(prompt).reprompt(prompt).shouldEndSession(false).send();
  });
  
  return false;  // Required for async calls to res.say
});

// Make a guess
app.intent('MakeGuess', { "slots": {"guess": "GUESS"}, "utterances": ["{-|guess}"] }, function (req, res) {
  const quiz   = req.session('quiz'),
        answer = quiz.quiz[quiz.currentQ].a,
        guess  = req.slot('guess');
  let   prompt = '';

  function convertGuess (guess) {
    switch (quiz.type) {
      case 'trueFalse':      return guess === 'true' ? true : false;
      case 'multipleChoice': return guess[0].toLowerCase();
    }
  }

  if (answer === convertGuess(guess)) {
    prompt = `Correct! `;
    quiz.results.push(true);

  } else {
    prompt = `Sorry, the answer was: ${quiz.quiz[quiz.currentQ].a}. `;
    quiz.results.push(false);
  }

  quiz.currentQ++;

  if (quiz.currentQ === quiz.quiz.length) {
    const accuracy = Math.round(quiz.results.reduce((a,b) => b ? a + 1 : a, 0) * 100 / quiz.quiz.length),
          options  = {
      method: 'POST',
      uri: 'https://alexaquiz.herokuapp.com/alexa',
      body: {
        name: quiz.name,
        results: quiz.results
      },
      json: true
    };

    rp(options).then(data => {
      prompt += `Your accuracy for this quiz was: ${accuracy} percent.`;
      res.say(prompt).send();
    });

    return false;  // Required for async calls to res.say

  } else {
    prompt += `${quiz.quiz[quiz.currentQ].q}.`;
    res.session('quiz', quiz);
    res.say(prompt).reprompt(prompt).shouldEndSession(false);
  }
});

// On 'Alexa help'
app.intent('AMAZON.HelpIntent', {}, function (req, res) {
  res.say(`What, this isn't easy enough for you?`);  // Help text goes here
  res.reprompt(`Try again.`);
  res.shouldEndSession(false);
});

// On 'Alexa stop' or 'Alexa cancel'
app.intent('AMAZON.StopIntent', {}, function (req, res) {
  res.say(`Thank you!`);
});
app.intent('AMAZON.CancelIntent', {}, function (req, res) {
  res.say(`Thank you!`);
});


module.exports = app;
