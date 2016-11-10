'use strict';

// Allow this module to be reloaded by hotswap when changed
// ( For alexa-app server )
module.change_code = 1;

const Alexa = require('alexa-app');
const app = new Alexa.app('speak-and-spell');

// On invocation
app.launch(function (req, res) {
	const prompt = `What would you like to study?`;

	// res.session('game', game);
	res.say(prompt).reprompt(prompt).shouldEndSession(false);
});


// On 'Alexa help'
app.intent('AMAZON.HelpIntent', {}, function (req, res) {
	res.say(``);  // Help text goes here
	res.reprompt(`Try again.`);
	res.shouldEndSession(false);
});

// On 'Alexa stop' or 'Alexa cancel'
app.intent('AMAZON.StopIntent', {}, function (req, res) {
	res.say(`Thanks!`);
});
app.intent('AMAZON.CancelIntent', {}, function (req, res) {
	res.say(`Thanks!`);
});

module.exports = app;
