module.exports = {
	"extends": [ "airbnb" ],
	parser: 'babel-eslint',
  env: {
    jest: true,
    browser: true,
    es6: true,
    mocha: true,
    node: true,
	},
	// Airbnb is great but very strict. Feel free to relax any rule.
	rules: {
		'max-len': ['error', { code: 140, ignoreUrls: true }],
		indent: ['error', 2, { SwitchCase: 1 }],
		'class-methods-use-this': 0,
		'object-curly-newline', 0
	},
};
