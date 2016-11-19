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
      LOGIN_FIRST = 'Please check your Alexa app and login with your Amazon account to continue. ',
      NO_QUIZ     = `You haven't picked a quiz yet. `,
      NEW_QUIZ    = 'Say: quiz me on, and the name of the quiz, to start a new quiz. ',  // You can also say, list quizzes, to hear some popular quizzes.
      CANCEL      = 'OK. Your results were not recorded. ';


// On invocation
app.launch(function (req, res) {

  // Require login
  if (!req.data.session.user.accessToken) {
    res.linkAccount().say(LOGIN_FIRST);
  
  } else {
  
    // If a quiz is in progress
    if (req.data.session.hasOwnProperty('quiz')) {
      const quiz   = req.session('quiz'),
            prompt = `The ${quiz.type === 'trueFalse' ? 'true false statement' : 'question'} is: ${quiz.questions[quiz.currentQ].q}`;

      res.say('There is already a quiz in progress. ' + prompt).reprompt(prompt).shouldEndSession(false);

    // If no quiz has been chosen
    } else {
      res.say(NEW_QUIZ).reprompt(NEW_QUIZ).shouldEndSession(false);
    }
  }
});

// Choose quiz
app.intent('PickQuiz', { "slots": {"quizName": "QUIZZES"}, "utterances": ["quiz me on {-|quizName}"] }, function (req, res) {
  console.log(req.data.session);

  // Require login
  if (!req.data.session.user.accessToken) {
    res.linkAccount().say(LOGIN_FIRST);
  
  } else {
    const quiz = req.data.session.attributes ? req.session('quiz') : false;

    // If a quiz is in progress
    if (quiz) {
      const prompt = `The ${quiz.type === 'trueFalse' ? 'true false statement' : 'question'} is: ${quiz.questions[quiz.currentQ].q}`;

      res.say('There is already a quiz in progress. ' + prompt).reprompt(prompt).shouldEndSession(false);

    // If no quiz has been chosen
    } else {
      const quizName = req.slot('quizName').toLowerCase(),
            options  = {
              uri: `https://alexaquiz.herokuapp.com/alexa/${quizName}.${req.data.session.user.accessToken || 'false'}`,
              json: true
            };

      console.log(quizName);

      rp(options).then(quiz => {
        
        // If a quiz named quizName was found
        if (quiz && quiz.name) {
          let prompt = `${quizName}, is a `;

          switch (quiz.type) {
            case 'trueFalse':
              prompt += `true or false quiz. Please respond with true, or false, to each statement. `;
              break;
            case 'multipleChoice':
              prompt += `multiple choice quiz. Please respond with, alpha, bravo, charlie, or delta, to each question. `;
              quiz.questions.forEach(question => question.q += ` Is it, A: ${question.choiceA}, B: ${question.choiceB}, C: ${question.choiceC}, or D: ${question.choiceD}?`);
              break;
          };

          quiz.currentQ = 0;
          quiz.ids = [];
          quiz.results = [];

          res.session('quiz', quiz);
          res.say(prompt + SSML_BREAK + quiz.questions[0].q).reprompt(quiz.questions[0].q).shouldEndSession(false).send();
        
        // If no quiz named quizName was found
        } else {
          res.say(`Sorry, no quiz named, ${quizName}, was found. Please try again.`).reprompt(NEW_QUIZ).shouldEndSession(false).send();
        }
      }).catch(() => {
        res.say('Sorry, there was a problem connecting to the server. Please try again later.').send();
      });
    
      return false;  // Required for async calls to res.say
    }
  }
});

// Make a guess
app.intent('MakeGuess', { "slots": {"guess": "GUESS"}, "utterances": ["{-|guess}"] }, function (req, res) {
  console.log(req.data.session);

  // Require login
  if (!req.data.session.user.accessToken) {
    res.linkAccount().say(LOGIN_FIRST);
  
  } else {
    
    // If a quiz is in progress
    if (req.data.session.attributes) {
      const quiz   = req.session('quiz'),
            answer = quiz.questions[quiz.currentQ].a,
            guess  = quiz.type === 'multipleChoice' ? req.slot('guess')[0].toLowerCase() : req.slot('guess');
      let   prompt = '';

      if (answer === guess) {
        prompt = `Correct! `;
        quiz.results.push(true);

      } else {
        let correctAns = '';
        if (quiz.type === 'multipleChoice') {
          switch (quiz.questions[quiz.currentQ].a) {
            case 'a': correctAns = ': ' + quiz.questions[quiz.currentQ].choiceA; break;
            case 'b': correctAns = ': ' + quiz.questions[quiz.currentQ].choiceB; break;
            case 'c': correctAns = ': ' + quiz.questions[quiz.currentQ].choiceC; break;
            default: correctAns = ': ' + quiz.questions[quiz.currentQ].choiceD; break;
          }
        }

        prompt = `Sorry, the answer was: ${quiz.questions[quiz.currentQ].a}${correctAns}. `;
        quiz.results.push(false);
      }

      quiz.ids.push(quiz.questions[quiz.currentQ].id);
      quiz.currentQ++;

      // If the quiz is over
      if (quiz.currentQ === quiz.questions.length) {
        const accuracy = Math.round(quiz.results.reduce((a,b) => b ? a + 1 : a, 0) * 100 / quiz.questions.length),
              options  = {
          method: 'POST',
          uri: 'https://alexaquiz.herokuapp.com/alexa',
          body: {
            accessToken: req.data.session.user.accessToken,
            name: quiz.name,
            ids: quiz.ids,
            results: quiz.results,
            accuracy: accuracy
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

      // If there are questions remaining
      } else {
        prompt += SSML_BREAK + `Next ${quiz.type === 'trueFalse' ? 'statement' : 'question'}: ${quiz.questions[quiz.currentQ].q}`;
        res.session('quiz', quiz);
        res.say(prompt).reprompt(prompt).shouldEndSession(false);
      }

    // If no quiz has been chosen
    } else {
      res.say(NO_QUIZ + NEW_QUIZ).reprompt(NEW_QUIZ).shouldEndSession(false);
    }
  }
});

// Repeat the question
app.intent('RepeatQuestion', { "utterances": ["{could you |} repeat the question"] }, function (req, res) {

  // Require login
  if (!req.data.session.user.accessToken) {
    res.linkAccount().say(LOGIN_FIRST);
  
  } else {
    // If a quiz is in progress
    if (req.session('quiz')) {
      const quiz   = req.session('quiz'),
            prompt = `The ${quiz.type === 'trueFalse' ? 'true false statement' : 'question'} is: ${quiz.questions[quiz.currentQ].q}`;

      res.say(prompt).reprompt(prompt).shouldEndSession(false);

    // If no quiz has been chosen
    } else {
      res.say(NO_QUIZ + NEW_QUIZ).reprompt(NEW_QUIZ).shouldEndSession(false);
    }
  }
});

// On 'Alexa help'
app.intent('AMAZON.HelpIntent', {}, function (req, res) {
  
  // Require login
  if (!req.data.session.user.accessToken) {
    res.linkAccount().say(LOGIN_FIRST);
  
  } else {
    res.say(`
      ${!req.session('quiz') ? NEW_QUIZ :
        `To make a guess, just say the guess.
        Say: repeat the question, to repeat the last question.
        Say: stop, or cancel, to end the quiz. No results will be recorded.`}
      Please visit the website to create your own quizzes, or find new quizzes to try.
    `);

    res.shouldEndSession(false);
  }
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
