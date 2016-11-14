'use strict';

// Allow this module to be reloaded by hotswap when changed
// ( For alexa-app server )
module.change_code = 1;

// Modules
const Alexa = require('alexa-app'),
      rp    = require('request-promise'),

      // Const vars
      app         = new Alexa.app('quiz_maker'),
      SSML_BREAK  = `<break time='75ms'/> `,
      LOGIN_FIRST = 'Please check your Alexa app and login with your Amazon account to continue.',
      NEW_QUIZ    = 'Say: quiz me on, and the name of the quiz, to start a new quiz.',  // You can also say, list quizzes, to hear some popular quizzes.
      CANCEL      = 'OK. Your results were not recorded.';


// On invocation
app.launch(function (req, res) {

  // if (!req.data.session.user.accessToken) {
  //   res.linkAccount().res.say('Please check your Alexa app and login with your Amazon account to continue.');
  
  // } else {
    res.say(NEW_QUIZ).reprompt(NEW_QUIZ).shouldEndSession(false);
  // }  
});

// Choose quiz
app.intent('PickQuiz', { "slots": {"quizName": "QUIZZES"}, "utterances": ["quiz {me|me on |} {-|quizName}"] }, function (req, res) {
  // if (!req.data.session.user.accessToken) {
  //   res.linkAccount().res.say('Please check your Alexa app and login with your Amazon account to continue.');
  
  // } else {

  // If a quiz is in progress
  if (req.session('quiz')) {
    const quiz = req.session('quiz');

    res.say(`There is already a quiz in progress. The ${quiz.type === 'trueFalse' ? 'true or false statement' : 'question'} is: ${quiz.quiz[quiz.currentQ].q}`);
    res.reprompt(quiz.quiz[quiz.currentQ].q).shouldEndSession(false);

  // If no quiz has been chosen
  } else {
    const quizName = req.slot('quizName').toLowerCase(),
          options  = {
            uri: `https://alexaquiz.herokuapp.com/alexa/${quizName}`,
            json: true
          };

    rp(options).then(quiz => {
      const q = quiz.quiz[0].q;
      let prompt = 'This is a ';

      switch (quiz.type) {
        case 'trueFalse':      prompt += `true or false quiz. Please respond with, true, or, false, to each statement. `; break;
        case 'multipleChoice': prompt += `multiple choice quiz. Please respond with, alpha, bravo, charlie, or delta, to each question. `; break;
      };

      quiz.currentQ = 0;
      quiz.ids = [];
      quiz.results = [];

      res.session('quiz', quiz);
      res.say(prompt + SSML_BREAK + q).reprompt(q).shouldEndSession(false).send();
    }).catch(() => {
      res.say('Sorry, there was a problem connecting to the server. Please try again later.').send();
    });
  
    return false;  // Required for async calls to res.say
  }
});

// Make a guess
app.intent('MakeGuess', { "slots": {"guess": "GUESS"}, "utterances": ["{guess|I'll guess|I'm guessing|is it |} {-|guess}"] }, function (req, res) {
  
  // If a quiz is in progress
  if (req.session('quiz')) {
    const quiz   = req.session('quiz'),
          answer = quiz.quiz[quiz.currentQ].a,
          guess  = quiz.type === 'multipleChoice' ? req.slot('guess')[0].toLowerCase() : req.slot('guess');
    let   prompt = '';

    if (answer === guess) {
      prompt = `Correct! `;
      quiz.results.push(true);

    } else {
      prompt = `Sorry, the answer was: ${quiz.quiz[quiz.currentQ].a}. `;
      quiz.results.push(false);
    }

    quiz.ids.push(quiz.quiz[quiz.currentQ].id);
    quiz.currentQ++;

    if (quiz.currentQ === quiz.quiz.length) {
      const accuracy = Math.round(quiz.results.reduce((a,b) => b ? a + 1 : a, 0) * 100 / quiz.quiz.length),
            options  = {
        method: 'POST',
        uri: 'https://alexaquiz.herokuapp.com/alexa',
        body: {
          name: quiz.name,
          ids: quiz.ids,
          results: quiz.results
        },
        json: true
      };

      rp(options).then(data => {
        prompt += SSML_BREAK + `The quiz is complete! Your accuracy was: ${accuracy} percent.`;
        res.say(prompt).send();
      }).catch(() => {
        res.say('Sorry, there was a problem connecting to the server. Your quiz results were not recorded.').send();
      });

      return false;  // Required for async calls to res.say

    } else {
      prompt += SSML_BREAK + `Next ${quiz.type === 'trueFalse' ? 'statement' : 'question'}: ${quiz.quiz[quiz.currentQ].q}.`;
      res.session('quiz', quiz);
      res.say(prompt).reprompt(prompt).shouldEndSession(false);
    }

  // If no quiz has been chosen
  } else {
    res.say(NEW_QUIZ).reprompt(NEW_QUIZ).shouldEndSession(false);
  }
});

// On 'Alexa help'
app.intent('AMAZON.HelpIntent', {}, function (req, res) {
  res.say(`
    ${!req.session('quiz') ? NEW_QUIZ :
      `To make a guess, just say it. If you wish, you may say, is it, before the guess.
      Say: repeat the question, to repeat the last question.
      Say: stop, or cancel, to end the quiz. No results will be recorded.`
    }
    Please visit the website to create your own quizzes, find new quizzes to try, or get more information.
  `);

  res.shouldEndSession(false);
});

// On 'Alexa stop' or 'Alexa cancel'
// Will say nothing if there is no quiz in progress
app.intent('AMAZON.StopIntent', {}, function (req, res) {
  res.say(req.session('quiz') ? CANCEL : '');
});
app.intent('AMAZON.CancelIntent', {}, function (req, res) {
  res.say(req.session('quiz') ? CANCEL : '');
});


module.exports = app;
