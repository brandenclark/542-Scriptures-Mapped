/*global
    console, google, map
*/
/*jslint
    browser: true
    long: true
*/
/*property
    Animation, DROP, LatLngBounds, Marker, animation, books, clearTimeout, exec,
    extend, fitBounds, forEach, fullName, getAttribute, getElementById, google,
    gridName, hash, id, init, innerHTML, label, lat, length, lng, log, map,
    maps, maxBookId, minBookId, numChapters, onHashChanged, onerror, onload,
    open, parentBookId, parse, position, push, querySelector, querySelectorAll,
    responseText, send, setMap, setTimeout, setZoom, slice, some, split, status,
    substring, title, tocName
*/

const Scriptures = (function () {

    /*---------------------------------------------------------------------------
        CONSTANTS
    */
    const INDEX_PLACENAME = 2;
    const INDEX_LATITUDE = 3;
    const INDEX_LONGITUDE = 4;
    const INDEX_PLACE_FLAG = 11;
    const LAT_LON_PARSER = /\((.*),'(.*)',(.*),(.*),(.*),(.*),(.*),(.*),(.*),(.*),'(.*)'\)/;
    const MAX_RETRY_DELAY = 5000;
    const SCRIPTURES_URL = "https://scriptures.byu.edu/mapscrip/mapgetscrip.php";

    /*---------------------------------------------------------------------------
        PRIVATE VARIABLES
    */
    let books;
    let gmMarkers = [];
    let retryDelay = 500;
    let volumes;

    /*---------------------------------------------------------------------------
        PRIVATE METHOD DECLARATONS
    */
    let addMarker;
    let ajax;
    let alterMarkerTooltip;
    let bookChapterValid;
    let cacheBooks;
    let clearMarkers;
    let encodedScriptureUrlParameters;
    let getScriptureCallBack;
    let getScriptureFailed;
    let hash;
    let init;
    let navigateBook;
    let navigateChapter;
    let navigateHome;
    let nextChapter;
    let onHashChanged;
    let previousChapter;
    let setBreadcrumb;
    let setMapBounds;
    let setupChapterNavigation;
    let setupMarkers;
    let showLocation;
    let titleForBookChapter;

    /*---------------------------------------------------------------------------
        PRIVATE METHODS
    */
    addMarker = function (placename, latitude, longitude) {
        //check if placename already exists
        //create the marker and append to gmMarkers
        if (!gmMarkers.some((e) => e.label === placename)) {
            let marker = new google.maps.Marker({
                position: {lat: latitude, lng: longitude},
                map: map,
                title: placename,
                label: placename,
                animation: google.maps.Animation.DROP
            });

            gmMarkers.push(marker);
        }
    };

    ajax = function (url, successCallback, failureCallback, skipParse, bookId, chapter) {
        let request = new XMLHttpRequest();

        request.open("GET", url, true);

        request.onload = function () {
            if (request.status >= 200 && request.status < 400) {
                let data;

                if (skipParse) {
                    data = request.responseText;
                } else {
                    data = JSON.parse(request.responseText);
                }

                if (typeof successCallback === "function") {
                    successCallback(data, bookId, chapter);
                }
            } else {
                if (typeof failureCallback === "function") {
                    failureCallback(request);
                }
            }
        };

        request.onerror = failureCallback;

        request.send();
    };

    alterMarkerTooltip = function () {
        let tooltips = document.querySelectorAll("div[style^=\"color: rgb(0, 0, 0); font-size: 14px;\"]");

        if (tooltips.length > 0 || tooltips) {
            tooltips.forEach(function (element) {
                element.innerHTML = "<br><br><br><br><br>" + element.innerHTML.replace(/<br>/g, "");;
            });
        } else {
            google.maps.event.addListener(map, 'idle', alterMarkerTooltip);
        }
    };

    bookChapterValid = function (bookId, chapter) {
        let book = books[bookId];

        if (book === undefined || chapter < 0 || chapter > book.numChapters) {
            return false;
        }

        if (chapter === 0 && book.numChapters > 0) {
            return false;
        }

        return true;
    };

    cacheBooks = function (callback) {
        volumes.forEach(function (volume) {
            let volumeBooks = [];
            let bookId = volume.minBookId;

            while (bookId <= volume.maxBookId) {
                volumeBooks.push(books[bookId]);
                bookId += 1;
            }

            volume.books = volumeBooks;
        });

        if (typeof callback === "function") {
            callback();
        }
    };

    clearMarkers = function () {
        gmMarkers.forEach(function (marker) {
            marker.setMap(null);
        });

        gmMarkers = [];
    };

    encodedScriptureUrlParameters = function (bookId, chapter, verses, isJst) {
        if (bookId !== undefined && chapter !== undefined) {
            let options = "";

            if (verses !== undefined) {
                options += verses;
            }

            if (isJst !== undefined) {
                options += "&jst=JST";
            }
            return SCRIPTURES_URL + "?book=" + bookId + "&chap=" + chapter + "&verses=" + options;
        }
    };

    getScriptureCallBack = function (chapterHtml, bookId, chapter) {
        document.getElementById("scriptures").innerHTML = chapterHtml;

        setupMarkers();
        setupChapterNavigation(bookId, chapter);
        google.maps.event.addListener(map, 'idle', alterMarkerTooltip);
    };

    getScriptureFailed = function () {
        console.log("Warning: unable to get scriptures from server.");
    };

    hash = function (volumeId, bookId, chapter) {
        let hashValue = "#";

        if (volumeId !== undefined) {
            hashValue += volumeId;

            if (bookId !== undefined) {
                hashValue += `:${bookId}`;

                if (chapter !== undefined) {
                    hashValue += `:${chapter}`;
                }
            }
        }

        location.hash = hashValue;
    };

    init = function (callback) {
        let booksLoaded = false;
        let volumesLoaded = false;

        ajax("https://scriptures.byu.edu/mapscrip/model/books.php", function (data) {
            books = data;
            booksLoaded = true;

            if (volumesLoaded) {
                cacheBooks(callback);
            }
        });
        ajax("https://scriptures.byu.edu/mapscrip/model/volumes.php", function (data) {
            volumes = data;
            volumesLoaded = true;

            if (booksLoaded) {
                cacheBooks(callback);
            }
        });
    };

    navigateBook = function (bookId) {
        let book = books[bookId];
        let navContents = "<div id=\"scripnav\">";
        setBreadcrumb(book.parentBookId, bookId);

        navContents += `<div class="volume"><a name="b${book.id}"/><h5>${book.fullName}</h5></div><div class="books">`;

        for(let i = 0; i < book.numChapters; i += 1) {
            navContents += `<a class="btn chapter" id="c${i + 1}" href="javascript:void(0);" onclick="Scriptures.hash(${book.parentBookId}, ${book.id}, ${i + 1})">${i + 1}</a>`;
        }

        navContents += "<br /><br /></div>";

        document.getElementById("scriptures").innerHTML = navContents;
    };

    navigateChapter = function (bookId, chapter) {
        if (bookId !== undefined) {
            setBreadcrumb(books[bookId].parentBookId, bookId, chapter);
            ajax(encodedScriptureUrlParameters(bookId, chapter), getScriptureCallBack, getScriptureFailed, true, bookId, chapter);
        }
    };

    navigateHome = function (volumeId) {
        let navContents = "<div id=\"scripnav\">";
        setBreadcrumb(volumeId);

        volumes.forEach(function (volume) {
            if (volumeId === undefined || volumeId === volume.id) {

                navContents += `<div class="volume"><a name="v${volume.id}"/><h5>${volume.fullName}</h5></div><div class="books">`;

                volume.books.forEach(function (book) {
                    navContents += `<a class="btn" id="${book.id}" href="javascript:void(0);" onclick="Scriptures.hash(${volume.id}, ${book.id})">${book.gridName}</a>`;
                });
                navContents += "<br /><br /></div>";
            }
        });

        document.getElementById("scriptures").innerHTML = navContents;
    };

    nextChapter = function (bookId, chapter) {
        let book = books[bookId];

        if (book !== undefined) {
            if (chapter < book.numChapters) {
                return [bookId, chapter + 1, titleForBookChapter(book, chapter + 1)];
            }

            let nextBook = books[bookId + 1];

            if (nextBook !== undefined) {
                let nextChapterValue = 0;

                if (nextBook.numChapters > 0) {
                    nextChapterValue = 1;
                }

                return [nextBook.id, nextChapterValue, titleForBookChapter(nextBook, nextChapterValue)];
            }
        }
    };

    onHashChanged = function () {
        let ids = [];

        if (location.hash !== "" && location.hash.length > 1) {
            ids = location.hash.substring(1).split(":");
        }

        if (ids.length <= 0) {
            navigateHome();
        } else if (ids.length === 1) {
            let volumeId = Number(ids[0]);

            if (volumeId < volumes[0].id || volumeId > volumes.slice(-1).id) {
                navigateHome();
            } else {
                navigateHome(volumeId);
            }
        } else if (ids.length >= 2) {
            let bookId = Number(ids[1]);

            if (books[bookId] === undefined) {
                navigateHome();
            } else {
                if (ids.length === 2) {
                    navigateBook(bookId);
                } else {
                    let chapter = Number(ids[2]);

                    if (bookChapterValid(bookId, chapter)) {
                        navigateChapter(bookId, chapter);
                    } else {
                        navigateHome();
                    }
                }
            }
        }
    };

    previousChapter = function (bookId, chapter) {
        let book = books[bookId];

        if (book !== undefined) {
            if (chapter > 1) {
                return [bookId, chapter - 1, titleForBookChapter(book, chapter - 1)];
            }

            let previousBook = books[bookId - 1];

            if (previousBook !== undefined) {
                let previousChapterValue = 0;

                if (previousBook.numChapters > 0) {
                    previousChapterValue = previousBook.numChapters;
                }

                return [previousBook.id, previousChapterValue, titleForBookChapter(previousBook, previousChapterValue)];
            }
        }
    };

    setBreadcrumb = function (volumeId, bookId, chapter) {
        let breadcrumb = "<div>";

        if (volumeId !== undefined) {
            breadcrumb += `<a href="javascript:void(0);" onclick="Scriptures.hash()">The Scriptures</a>`
            breadcrumb += ` > <a href="javascript:void(0);" onclick="Scriptures.hash(${volumeId})">${volumes[volumeId - 1].fullName}</a>`;
            if (bookId !== undefined) {
                breadcrumb += ` > <a href="javascript:void(0);" onclick="Scriptures.hash(${volumeId}, ${bookId})">${books[bookId].fullName}</a>`;
                if (chapter !== undefined) {
                    breadcrumb += ` > ${chapter}`;
                }
            }
        } else {
            breadcrumb += "The Scriptures";
        }

        breadcrumb += '</div>'

        document.getElementById("crumb").innerHTML = breadcrumb;

    };

    setMapBounds = function (zoomMarker) {
        let bounds = new google.maps.LatLngBounds();

        if (gmMarkers.length > 0) {
            if (zoomMarker) {
                bounds.extend(zoomMarker.position);
            } else {
                gmMarkers.forEach(function (marker) {
                    bounds.extend(marker.position);
                });
            }
            map.fitBounds(bounds);
        }

        if (gmMarkers.length === 1 || zoomMarker) {
            // let zoom =
            map.setZoom(10);
        }
    };

    setupChapterNavigation = function (bookId, chapter) {
        let navIcons = "";
        let previousChapterInfo = previousChapter(bookId, chapter);
        let nextChapterInfo = nextChapter(bookId, chapter);
        let previousBook;
        let nextBook;

        if (previousChapterInfo) {
            previousBook = books[previousChapterInfo[0]];
        }
        if (nextChapterInfo) {
            nextBook = books[nextChapterInfo[0]];
        }

        if (previousBook) {
            navIcons += `<a href = "javascript:void(0);" onclick = "Scriptures.hash(${previousBook.parentBookId}, ${previousChapterInfo[0]}, ${previousChapterInfo[1]})" title = "${previousChapterInfo[2]}" > <i class="material-icons">skip_previous</i></a>`;
        }

        if (nextBook) {
            navIcons += `<a href = "javascript:void(0);" onclick = "Scriptures.hash(${nextBook.parentBookId}, ${nextChapterInfo[0]}, ${nextChapterInfo[1]})" title = "${nextChapterInfo[2]}" > <i class="material-icons">skip_next</i></a>`;
        }

        if (navIcons) {
            document.querySelector("div[class^=\"navheading\"]").innerHTML += "<div class=\"navicons\">" + navIcons + "</div>";
        }
    };

    setupMarkers = function () {
        if (window.google === undefined) {
            let retryId = window.setTimeout(setupMarkers, retryDelay);

            retryDelay *= 2;

            if (retryDelay > MAX_RETRY_DELAY) {
                window.clearTimeout(retryId);
            }
        } else {

            clearMarkers();

            document.querySelectorAll("a[onclick^=\"showLocation(\"]").forEach(function (element) {
                let matches = LAT_LON_PARSER.exec(element.getAttribute("onclick"));

                if (matches) {
                    let placename = matches[INDEX_PLACENAME];
                    let latitutde = parseFloat(matches[INDEX_LATITUDE]);
                    let longitude = parseFloat(matches[INDEX_LONGITUDE]);
                    let flag = matches[INDEX_PLACE_FLAG];

                    if (flag !== "") {
                        placename += " " + flag;
                    }

                    addMarker(placename, latitutde, longitude);
                }
            });

            setMapBounds();
        }
    };

    showLocation = function (placename, latitude, longitude, viewAltitude) {
        setMapBounds(gmMarkers.find((e) => e.label.split(" ")[0] === placename));

        google.maps.event.addListener(map, 'idle', alterMarkerTooltip);
    };

    titleForBookChapter = function (book, chapter) {
        if (chapter > 0) {
            return book.tocName + " " + chapter;
        }

        return book.tocName;
    };

    /*---------------------------------------------------------------------------
        PUBLIC API
    */
    return {
        hash: hash,
        init: init,
        onHashChanged: onHashChanged,
        showLocation: showLocation
    };
}());