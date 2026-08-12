// https://stackoverflow.com/questions/1977871/check-if-an-image-is-loaded-no-errors-with-jquery
function IsImageOk(img, loadingImage) {
    if (img.src == loadingImage)
    {
        return false;
    }
    // During the onload event, IE correctly identifies any images that
    // weren’t downloaded as not complete. Others should too. Gecko-based
    // browsers act like NS4 in that they report this incorrectly.
    if (!img.complete) {
        return false;
    }
    else
    {
        return true;
    }

    // However, they do have two very useful properties: naturalWidth and
    // naturalHeight. These give the true size of the image. If it failed
    // to load, either of these should be zero.
    if (img.naturalWidth === 0) {
        return false;
    }

    // No other way of checking: assume it’s not ok.
    return false;
}

var Singleton = (function(){
    function Singleton(rand) {
        var list = document.querySelector('.carousel-inner'), i;
        if(rand)
        {
            if(list.children.length)
            {
                for (i = list.children.length; i >= 0; i--) {
                    list.appendChild(list.children[Math.random() * i | 0]);
                }
            }
        }
        this.nodeList = list.children;
    }
    Singleton.prototype.nodeList = {};
    var instance;
    return {
        getInstance: function(rand){
            if (null == instance) {
                instance = new Singleton(rand);               
                instance.constructor = null; // Note how the constructor is hidden to prevent instantiation
            }
            return instance; //return the singleton instance
        }
   };
})();

window.addEventListener('DOMContentLoaded', () => {
    const imgElements = document.querySelectorAll('.carousel-image');
    const ieLength = imgElements.length;
    if(ieLength)
    {
        const nextIndicator = document.querySelector('.carousel-control-next');
        const prevIndicator = document.querySelector('.carousel-control-prev');
        const dataEl = document.getElementById('hidden-data');
        const offset = dataEl.dataset.offset == 'False' ? false : true;
        const randomizeImages = dataEl.dataset.randomizeImages == 'True' ? true : false;
        const loadingImage = location.protocol + "//" + location.host + dataEl.dataset.loadingImage;
        var carouselEl = document.querySelector('#carousel-large-background');
        let carousel = bootstrap.Carousel.getInstance(carouselEl);
        var nodes = Singleton.getInstance(randomizeImages).nodeList;

        // handles first image.
        const callback = function(changes, observer)
        {
            changes.forEach(change => {
                carousel.pause()
                if (change.attributeName == 'src') {
                    observer.disconnect();
                    if(change.target.src == loadingImage)
                    {
                        observer.observe(change.target, {
                            attributes: true
                        }); 
                    }
                    else
                    {
                        carousel.cycle();
                    }
                }
            });
        };
        const observer = new MutationObserver(callback)

        carousel._items = nodes;
        firstActiveImg = carousel._items[0].children[0];
        if(firstActiveImg)
        {
            firstActiveImg.parentElement.classList.add('active');
        }

        if(offset)
        {
            firstActiveImg.src = firstActiveImg.dataset.imageSrc;
        }

        carousel.pause();

        if (IsImageOk(firstActiveImg, loadingImage))
        {
            carousel.cycle();
        }
        else
        {   
            config = { attributes: true };
            observer.observe(firstActiveImg, config );
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const dataEl = document.getElementById('hidden-data');
    const randomizeImages = dataEl.dataset.randomizeImages == 'True' ? true : false;
    const nodes = Singleton.getInstance(randomizeImages).nodeList;
    if(nodes.length)
    {
        const useCache = dataEl.dataset.useCache == 'True' ? true : false;
        const imagesPerRequest = parseInt(dataEl.dataset.imagesPerRequest);
        const imageSizeLarge = dataEl.dataset.imageSizeLarge;
        const imageSizeSmall = dataEl.dataset.imageSizeSmall;
        const screenSize = window.innerWidth < 500 ? imageSizeSmall : imageSizeLarge;
        const siteUrl = location.protocol + "//" + location.host + "/imgurl/";
        const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        const ImageLoaderWorker = new Worker('/static/django_bs_carousel/js/imageLoader.js', {'type': 'classic', 'credentials': 'same-origin'});
        var iteration = 0;
        let closing = false;
        function closingCode(){
            closing == true;
            ImageLoaderWorker.terminate();
            return null;
        }
        window.onbeforeunload = closingCode;
        
        function pm() {
            if (!closing)
            {
                let start = iteration * imagesPerRequest;
                let finish = iteration * imagesPerRequest + imagesPerRequest;
                if(useCache)
                {
                    pks = [];
                    indexes = [];
                    idx = 0;
                    for(i of Array.prototype.slice.call(nodes, start, finish))
                    {
                        indexes.push(start + idx)
                        pks.push(parseInt(i.children[0].id));
                        idx++;
                    }
                    ImageLoaderWorker.postMessage({
                        'pks': pks,
                        'iteration': iteration,
                        'indexes': indexes,
                        'useCache': useCache,
                        'screenSize': screenSize,
                        'requestUrl': siteUrl,
                        'token': csrftoken,
                        'randomizeImages': randomizeImages,
                    });
                }
                else
                {

                    let urls = [];
                    var index = start;
                    for (i of Array.prototype.slice.call(nodes, start, finish))
                    {
                        urls.push({'id': index, 'url': i.children[0].dataset.imageSrc});
                        index++;
                    }
                    ImageLoaderWorker.postMessage({
                       'urls': urls,
                       'useCache': useCache,
                       'screenSize': screenSize,
                       'requestUrl': siteUrl,
                       'token': csrftoken,
                   }); 
                }
            }
        }

        let hid = false;
        ImageLoaderWorker.addEventListener('message', event => {
            const imageData = event.data;
            const ids = imageData.ids;
            const abs = imageData.abs;
            ids.forEach((id,idx) =>{
                var mimestring = "image/webp";
                var blob = new Blob([abs[idx]], { type: mimestring });
                
                var imageElement = nodes[id].children[0];
                var objectURL = URL.createObjectURL(blob);

                // Once the image is loaded, we'll want to do some extra cleanup
                if (imageElement)
                {
                  imageElement.onload = () => {
                    URL.revokeObjectURL(objectURL);
                  }
                  imageElement.removeAttribute('data-image-src');
                  imageElement.setAttribute('size', screenSize);
                  imageElement.setAttribute('src', objectURL);
                }
            })
            if(iteration < nodes.length / imagesPerRequest)
            { 
                if(!document.hidden && window.location.pathname == '/')
                {
                    pm();
                    iteration++;
                }
                else
                {
                    hid = true;
                }
            }
        })

        pm();
        iteration++;

        document.addEventListener('visibilitychange', function (event) {
            if (!document.hidden) {
                if (window.location.pathname == '/' && hid)
                {
                    hid = false;
                    pm();
                    iteration++;
                }
            }
        });
    }
});