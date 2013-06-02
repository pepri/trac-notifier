// In the localStorage, we need to store the URLs we are following
// together with the timestamp of the last update.
//
// trac.base:$base = {
//   base: $base,
//   user: $user,
//   pass: $pass,
//   url: {
//	   $url1: {
//       title: $title,
//       updatedOn: $updatedOn
//     }
//   }
// }
// trac[$base].rss:$path = { title: $title, updated_on: $updated_on }
//
// The variable tracs holds objects sorted by Trac base.
// While following multiple URLs in the same Trac application,
// we need to store the guids of the items that are newer than
// the oldest update, so we do not notify the user twice about
// the same item.
// On the beginning, it is initialized from localStorage.
// Then changes are made to both tracs object and localStorage.
//
// {
//   timer: timer for refreshing the trac
// }
var tracs = new Object;
var icons = [
	'attachment',
	'batchmodify',
	'closedticket',
	'editedticket',
	'changeset',
	'milestone',
	'newticket',
	'reopenedticket',
	'wiki'
];

function login(callback, base) {
	var trac = tracs[base];
	if (!trac)
		return;

	if (trac.username) {
		var args = arguments;
		var xhr = new XMLHttpRequest;
		xhr.onreadystatechange = function() {
			if (xhr.readyState == 4 && xhr.status != 403) {
				if (xhr.status == 200) {
 					var doc = document.implementation.createHTMLDocument('');
 					doc.documentElement.innerHTML = xhr.response;
 					var form = doc.getElementById('acctmgr_loginform');
 					if (form.user && form.password) {
 						retry = false;
	 					form.user.value = trac.username;
	 					form.password.value = trac.password;
	 					var data = new FormData(form);
	 					var xhr2 = new XMLHttpRequest();  
	 					xhr2.onreadystatechange = function() {
							if (xhr2.readyState == 4 && xhr2.status == 200) {
								callback.apply(window, Array.prototype.slice.call(args, 1));
							}
	 					};
 						xhr2.open('POST', base + '/login');  
 						xhr2.send(data);
 					} else {
						callback.apply(window, Array.prototype.slice.call(args, 1));
					}
				}
			}
		};
		xhr.open('GET', base + '/login', true, trac.username, trac.password);
		xhr.send();
	}
}

function each(el, name, ns, fn) {
	if (arguments.length == 3) {
		fn = ns;
		ns = null;		
	}
	if (el) {
		var chs = el.childNodes;
		for (var i = 0, n = chs.length; i < n; ++i) {
			var ch = chs[i];
			if (ch.nodeType == 1 && ch.localName == name && (ns == null || ch.namespaceURI == ns))
				if (fn(ch) === false)
					return;
		}
	}
}

function text(el, name, ns) {
	var result = null;
	each(el, name, ns, function(n) {
		result = n.textContent;
		return false;
	});
	return result;
}

function getInfo(base, url, sendResponse, calledFromLogin) {
	var xhr = new XMLHttpRequest;
	xhr.onreadystatechange = function() {
		if (xhr.readyState != 4)
			return;
		if (!calledFromLogin && xhr.status == 403) {
			login(getInfo, base, url, sendResponse, true);
			return;
		}
		console.log(xhr.responseXML);
		if (xhr.responseXML)
			each(xhr.responseXML, 'rss', function(rss) {
				each(rss, 'channel', function(channel) {
					sendResponse({
						title: text(channel, 'title'),
						link: text(channel, 'link'),
						description: text(channel, 'description')
					});
				});
			});
		else
			sendResponse();
	};
	xhr.open('GET', url);
	xhr.send();
}

function notify(base, path, calledFromLogin) {
	var xhr = new XMLHttpRequest;
	xhr.onreadystatechange = function() {
		if (xhr.readyState != 4)
			return;
		if (!calledFromLogin && xhr.status == 403) {
			login(notify, base, path, true);
			return;
		}
		console.log(base, xhr.responseXML);
		var trac = tracs[base];
		var url = trac.urls[path];
		if (!url)
			return;
		var updatedOn = url.updatedOn;
		each(xhr.responseXML, 'rss', function(rss) {
			each(rss, 'channel', function(channel) {
				each(channel, 'item', function(item) {
					var maxPubDate = url.updatedOn;
					each(item, 'pubDate', function(pubDate) {
						var date = new Date(pubDate.textContent);
						if (date > maxPubDate)
							maxPubDate = date;
					});
					var pubDate = maxPubDate;
					if (pubDate > updatedOn)
						updatedOn = pubDate;
					if (pubDate > url.updatedOn) {
						var title = text(item, 'title');
						var creator = text(item, 'author') || text(item, 'creator', 'http://purl.org/dc/elements/1.1/');
						var link = text(item, 'link');
						var guid = text(item, 'guid');
						var category = text(item, 'category');
						var div = document.createElement('div');
						div.innerHTML = text(item, 'description');
						var description = div.textContent;
						var icon = icons.indexOf(category) != -1 ? category : 'editedticket';
						var settings = {
							icon: chrome.extension.getURL('/images/' + icon + '.png'),
							title: '@' + creator + ': ' + title,
							body: description,
							tag: guid
						};
						console.log('Notification: ' + settings.title, settings);
						var notification = new Notification(settings.title, settings);
						notification.onclick = function(e) {
							open(link);
							this.close();
						};
						notification.show();
					}
				});
			});
		});
		url.updatedOn = updatedOn;
		saveTrac(trac);
	};
	xhr.open('GET', path);
	xhr.send();
}

function saveTrac(trac) {
	localStorage['trac.base:' + trac.base] = JSON.stringify(trac);
}

function newTrac(base) {
	return {
		base: base,
		user: null,
		pass: null,
		interval: 30000,
		urls: new Object
	};
}

function followTrac(config) {
	var base = config.base;
	var path = config.path;

	var trac = tracs[base];
	if (!trac)
		tracs[base] = trac = newTrac(base);

	var url = trac.urls[path];
	if (!url)
		trac.urls[path] = url = {
			updatedOn: new Date()// - 30 * 60 * 1000
		}
	url.title = config.title;
	url.link = config.link;
	url.description = config.description;

	if (url.timer) {
		clearInterval(url.timer);
		delete url.timer;
	}

	saveTrac(trac);
	watch(base, path);
}

function unfollowTrac(base, path) {
	var trac = tracs[base];
	if (!trac)
		return;

	var url = trac.urls[path];
	if (!url)
		return;

	if (url.timer) {
		console.log('Unwatching: ' + path);
		clearInterval(url.timer);
	}
	
	delete trac.urls[path];
	saveTrac(trac);
}

function deleteTrac(base) {
	var trac = tracs[base];
	if (!trac)
		return;

	for (var path in trac.urls) {
		var url = trac.urls[path];
		if (url.timer) {
			console.log('Unwatching: ' + path);
			clearInterval(url.timer);
		}
	}

	console.log('Deleting: ' + trac.base);
	delete tracs[trac.base];
	localStorage.removeItem('trac.base:' + trac.base);
}

function setTracAuthentication(base, username, password) {
	var trac = tracs[base];
	if (!trac)
		return;

	trac.username = username;
	trac.password = password;
	saveTrac(trac);
}

function watch(base, path) {
	var trac = tracs[base];
	var url = trac.urls[path];
	console.log('Watching (' + (coerceInterval(trac.interval) / 1000) + 's): ' + path);
	url.timer = setInterval(function() {
		notify(base, path);
	}, coerceInterval(trac.interval));
}

function coerceInterval(interval) {
	return Math.max(interval || 30 * 1000, 5 * 1000);
}

function setTracInterval(base, interval) {
	var trac = tracs[base];
	if (!trac)
		return;

	trac.interval = coerceInterval(interval * 1000);
	saveTrac(trac);

	for (var url in trac.urls) {
		var tracUrl = trac.urls[url];
		console.log('Rewatching (' + (coerceInterval(trac.interval) / 1000) + 's): ' + url);
		clearInterval(tracUrl.timer);
		tracUrl.timer = setInterval(function() {
			notify(trac.base, url);
		}, coerceInterval(trac.interval));
	}
}

function init() {
	var baseKey = 'trac.base:';
	for (var x in localStorage)
		if (x.substr(0, baseKey.length) == baseKey) {
			var base = x.substr(baseKey.length);
			var trac = JSON.parse(localStorage[x]);
			tracs[base] = trac;
			for (var path in trac.urls)
				if (trac.urls.hasOwnProperty(path)) {
					var tracUrl = trac.urls[path];
					tracUrl.updatedOn = new Date(tracUrl.updatedOn);
					watch(base, path);
				}
		}
}

chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
	var command = request && request.command;
	switch (command) {
		case 'showPageAction':
			chrome.pageAction.show(sender.tab.id);
			sendResponse();
			break;
		case 'getFollowed':
			sendResponse(tracs[request.base] || newTrac(request.base));
			break;
		case 'getAll':
			sendResponse(tracs);
			break;
		case 'getInfo':
			getInfo(request.base, request.url, sendResponse);
			break;
		case 'followTrac':
			followTrac({
				base: request.base,
				path: request.path,
				title: request.title,
				link: request.link,
				description: request.description
			});
			sendResponse();
			break;
		case 'unfollowTrac':
			unfollowTrac(request.base, request.path);
			sendResponse();
			break;
		case 'setTracAuthentication':
			setTracAuthentication(request.base, request.username, request.password);
			sendResponse();
			break;
		case 'deleteTrac':
			deleteTrac(request.base);
			sendResponse();
			break;
		case 'setInterval':
			setTracInterval(request.base, request.interval);
			sendResponse();
			break;
		default:
			sendResponse();
	}
});

init();
