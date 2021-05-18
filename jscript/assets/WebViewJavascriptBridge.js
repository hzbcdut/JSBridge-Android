//notation: js file can only use this kind of comments
//since comments will cause error when use in webview.loadurl,
//comments will be remove by java use regexp
//jscript文件下的js文件为新版本SDK内部字符串压缩前的原文件，此文件只为了供大家查看使用，不需要添加到项目中；
//JS源文件在java代码中已经做了压缩处理
(function() {
    if (window.WebViewJavascriptBridge) {
        return;
    }

    var receiveMessageQueue = [];
    var messageHandlers = {};

    var responseCallbacks = {};
    var uniqueId = 1;

    //set default messageHandler  初始化默认的消息线程
    function init(messageHandler) {
        if (WebViewJavascriptBridge._messageHandler) {
            throw new Error('WebViewJavascriptBridge.init called twice');
        }
        WebViewJavascriptBridge._messageHandler = messageHandler;
        var receivedMessages = receiveMessageQueue;
        receiveMessageQueue = null;
        for (var i = 0; i < receivedMessages.length; i++) {
            _dispatchMessageFromNative(receivedMessages[i]);
        }
    }

    // 发送
    function send(data, responseCallback) {
        _doSend('jsbridge','send', data, responseCallback);
    }

    // 注册线程 往数组里面添加值
    function registerHandler(handlerName, handler) {
        messageHandlers[handlerName] = handler;
    }
    // 调用线程
    function callHandler(handlerName, data, responseCallback) {

        _doSend('jsbridge',handlerName, data, responseCallback);
    }

    // 调用线程
    function callHandlerWithModule(moduleName,handlerName, data, responseCallback) {

        _doSend(moduleName,handlerName, data, responseCallback);
    }

    //sendMessage add message, 触发WebViewJavascriptBridge处理 sendMessage
    function _doSend(moduleName,handlerName, message, responseCallback) {
        var callbackId;
        if(typeof responseCallback === 'string'){
            callbackId = responseCallback;
        } else if (responseCallback) {
            callbackId = 'cb_' + (uniqueId++) + '_' + new Date().getTime();
            //console.log("callbackId->"+callbackId);
            responseCallbacks[callbackId] = responseCallback;
        }else{
            callbackId = '';
        }
        try {
             var evalStr1 = 'window.'+ moduleName + '.';
             if(moduleName == 'jsbridge'&& handlerName!='response'){
                //默认实现方法名
                evalStr1 += 'handler';
             }else{
                evalStr1 += handlerName;
             }
             //可计算某个字符串，并执行其中的的 JavaScript 代码
             var fn = eval(evalStr1);
         } catch(e) {
             console.log(e);
         }
         if (typeof fn === 'function'){

             var evalStr = 'window.'+moduleName;

             var fnwindow = eval(evalStr);
             var responseData;
             if(moduleName == 'jsbridge'&& handlerName !='response'){
                responseData = fn.call(fnwindow,handlerName,JSON.stringify(message),callbackId);
             }else{
                responseData = fn.call(fnwindow,JSON.stringify(message),callbackId);
             }
             if(responseData){
                 responseCallback = responseCallbacks[callbackId];
                 if (!responseCallback) {
                     return;
                  }
                 responseCallback(responseData);
                 delete responseCallbacks[callbackId];
             }
         }
    }

    //提供给WebViewJavascriptBridge使用,
    function _dispatchMessageFromNative(messageJSON) {
        setTimeout(function() {
            var message = JSON.parse(messageJSON);
            var responseCallback;
            //java call finished, now need to call js callback function
            if (message.responseId) {
                responseCallback = responseCallbacks[message.responseId];
                if (!responseCallback) {
                    return;
                }
                responseCallback(message.responseData);
                delete responseCallbacks[message.responseId];
            } else {
                //直接发送
                if (message.callbackId) {
                    var callbackResponseId = message.callbackId;
                    responseCallback = function(responseData) {
                        _doSend('jsbridge','response', responseData, callbackResponseId);
                    };
                }

                var handler = WebViewJavascriptBridge._messageHandler;
                if (message.handlerName) {
                    handler = messageHandlers[message.handlerName];
                }
                //查找指定handler
                try {
                    handler(message.data, responseCallback);
                } catch (exception) {
                    if (typeof console != 'undefined') {
                        console.log("WebViewJavascriptBridge: WARNING: javascript handler threw.", message, exception);
                    }
                }
            }
        });
    }

    //提供给WebViewJavascriptBridge调用,receiveMessageQueue 在会在页面加载完后赋值为null,所以
    //原生队列将json返回值通过这个方法
    function _handleMessageFromNative(messageJSON) {
        if (receiveMessageQueue) {
            receiveMessageQueue.push(messageJSON);
        }
        _dispatchMessageFromNative(messageJSON);
       
    }

    var WebViewJavascriptBridge = window.WebViewJavascriptBridge = {
        init: init,
        send: send,
        registerHandler: registerHandler,
        callHandler: callHandler,
        callHandlerWithModule: callHandlerWithModule,
        _handleMessageFromNative: _handleMessageFromNative
    };

    console.log("start jsbridge ...");

    var doc = document;
    var readyEvent = doc.createEvent('Events');
    readyEvent.initEvent('WebViewJavascriptBridgeReady');
    readyEvent.bridge = WebViewJavascriptBridge;
    doc.dispatchEvent(readyEvent);

    console.log("end jsbridge ...");

})();
