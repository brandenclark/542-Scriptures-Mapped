/*jslint
    browser: true
    long: true
*/
/*global console*/
/*property
    books, forEach, getElementById, hash, id, init, innerHTML, length, log,
    maxBookId, minBookId, onHashChanged, onerror, onload, open, parse, push,
    responseText, send, slice, split, status, substring
*/

const Scriptures = (function () {
    "use strict";

    // CONSTANTS

    // PRIVATE VARIABLES
    let books;
    let volumes;

    // PRIVATE METHOD DECLARATONS
    let ajax;
    let cacheBooks;
    let init;
    let navigateBook;
    let navigateBookChapter;
    let navigateHome;
    let onHashChanged;

    // PRIVATE METHODS
    ajax = function (url, successCallback, failureCallback) {
        let request = new XMLHttpRequest();

        request.open("GET", url, true);

        request.onload = function () {
            if (request.status >= 200 && request.status < 400) {
                let data = JSON.parse(request.responseText);

                if (typeof successCallback === "function") {
                    successCallback(data);
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

    cacheBooks = function(callback) {
        volumes.forEach(function (volume) {
            let volumeBooks = [];
            let bookId = volume.minBookId;

            while (bookId <= volume.maxBookId){
                volumeBooks.push(books[bookId]);
                bookId += 1;
            }

            volume.books = volumeBooks;
        });
    };

    init = function (callback) {
        let booksLoaded = false;
        let volumesLoaded = false;

        ajax("https://scriptures.byu.edu/mapscrip/model/books.php",
            function (data) {
                books = data;
                booksLoaded = true;

                if (volumesLoaded) {
                    cacheBooks(callback);
                }
            }
        );
        ajax("https://scriptures.byu.edu/mapscrip/model/volumes.php",
            function (data) {
                volumes = data;
                volumesLoaded = true;

                if (booksLoaded) {
                    cacheBooks(callback);
                }
            }
        );
    };

    navigateBook = function (bookId) {
        console.log(bookId);
    };

    navigateBookChapter = function (bookId, chapterId) {
        console.log(bookId + chapterId);
    };

    navigateHome = function (volumeId) {

        document.getElementById("scriptures").innerHTML =
            "<div>The Old Testament</div>" +
            "<div>The New Testament</div>" +
            "<div>The Book of Mormon</div>" +
            "<div>The Pearl of Great Price</div>" +
            volumeId;
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
        } else if (ids.length === 2) {
            let bookId = Number(ids[1]);

            if (books[bookId] === undefined) {
                navigateHome();
            } else {
                navigateBook(bookId);
            }
        } else {
            navigateBookChapter();
        }
    };

    // PUBLIC API
    return {
        init: init,
        onHashChanged: onHashChanged
    };
}());