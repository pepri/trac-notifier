function $(id) {
	return document.getElementById(id);
}

var currentQuery = {
	currentWindow: true,
	active: true
};

function getAll(callback) {
	var command = {
		command: 'getAll'
	};
	chrome.extension.sendRequest(command, function(tracs) {
		callback(tracs);
	});
}

function getFollowed(base, callback) {
	var command = {
		command: 'getFollowed',
		base: base
	};
	chrome.extension.sendRequest(command, function(trac) {
		callback(trac);
	});
}

function deleteTrac(base, callback) {
	var command = {
		command: 'deleteTrac',
		base: base
	};
	chrome.extension.sendRequest(command, function(trac) {
		callback(trac);
	});
}

function setTracAuthentication(base, username, password, callback) {
	var command = {
		command: 'setTracAuthentication',
		base: base,
		username: username,
		password: password
	};
	chrome.extension.sendRequest(command, function(trac) {
		if (callback)
			callback(trac);
	});
}

function htmlEncode(str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function removeFormatParam(url) {
	return url.replace(/(\?|&)format=rss(?:&|$)/g, '$1').replace(/\?$/g, '');
}

function createUrlHtml(url, tracUrl) {
	var html = new Array;
	html.push(
		'<li>',
		'<input type="checkbox" name="url" checked="checked" data-url="', htmlEncode(url) , '" /> ',
		'<span>',
		'<a href="', htmlEncode(tracUrl.link), '" target="_blank">', htmlEncode(tracUrl.title), '</a>',
		'<i title="', htmlEncode(tracUrl.description), '">', htmlEncode(tracUrl.description), '</i>',
		'</span>',
		'</li>');
	return html.join('');
}

getAll(function(tracs) {
	var html = 	new Array;
	for (var base in tracs) {
		var trac = tracs[base];
		html.push('<form data-trac="' + htmlEncode(base) + '">');
		html.push('<a href="#" class="delete">Delete</a>');
		html.push('<h2><a href="', htmlEncode(base), '" target="_blank">', htmlEncode(base), '</a></h2>');
		html.push('<ul>');
		for (var url in trac.urls) {
			var tracUrl = trac.urls[url];
			html.push(createUrlHtml(url, tracUrl));
		}
		html.push('</ul>');
		html.push(
			'<p class="actions">',
			'<label>',
			'Refresh every ',
			'<input name="refresh" type="number" value="', htmlEncode(trac.interval / 1000), '" />',
			' seconds.',
			'</label>',
			'<label><input name="basic" type="checkbox"', (trac.username ? ' checked="checked"': ''), '/> Use basic authentication</label>',
			'<span', (!trac.username ? ' style="display: none;"' : ''), '>',
			' <label>User: <input name="username" size="8" value="', htmlEncode(trac.username || ''), '" /></label>',
			' <label>Password: <input name="password" type="password" size="8" value="', htmlEncode(trac.password || ''), '" /></label>',
			' <input type="button" name="save" value="Save" style="display: none;" />',
			'</span>',
			'</p>');
		html.push('</form>');
	}
	if (!html.length)
		html.push('<form><p>There are no tracs to watch.</p></form>');
	$('tracs').insertAdjacentHTML('afterbegin', html.join(''));

	$('tracs').onclick = function(e) {
		if (e.target.tagName == 'INPUT' && e.target.type == 'checkbox') {
			var input = e.target;
			var form = input.form;
			getFollowed(form.dataset.trac, function(trac) {
				if (input.name == 'url') {
					var url = input.dataset.url;
					var tracUrl = trac.urls[url];
					if (tracUrl) {
						var req = {
							command: e.target.checked ? 'followTrac' : 'unfollowTrac',
							base: trac.base,
							path: url,
							title: tracUrl.title,
							description: tracUrl.description,
							link: tracUrl.link
						};
						chrome.extension.sendRequest(req, function(response) {
						});
					} else {
						input.checked = true;
					}
				} else if (input.name == "basic") {
					input.parentNode.nextSibling.style.display = input.checked ? '' : 'none';
					if (input.checked)
						setTracAuthentication(form.dataset.trac, form.username.value, form.password.value);
					else
						setTracAuthentication(form.dataset.trac, null, null);
				}
			});
		} else if (e.target.tagName == 'A') {
			if (e.target.className == 'delete') {
				for (var f = e.target; f; f = f.parentNode)
					if (f.tagName == 'FORM') {
						deleteTrac(f.dataset.trac, function() {
							f.parentNode.removeChild(f);
						});
						break;
					}
			} else {
				open(e.target.href);
			}
			return false;
		}
	};

	$('tracs').oninput = function(e) {
		var input = e.target;
		if (input.name == 'username' || input.name == 'password') {
			var form = input.form;
			var save = form.save;
			save.style.display = '';
			save.disabled = false;
			save.onclick = function() {
				save.onclick = null;
				save.disabled = true;
				setTracAuthentication(form.dataset.trac, form.username.value, form.password.value, function() {
					save.style.display = 'none';
				})
			};
		}
	};

	$('tracs').onchange = function(e) {
		var input = e.target;
		if (input.name == 'refresh') {
			var form = input.form;
			var req = {
				command: 'setInterval',
				base: form.dataset.trac,
				interval: input.value
			};
			chrome.extension.sendRequest(req, function(response) {
			});
		}
	};
});
