import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Color(0xFF0F0C29),
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: Color(0xFF0F0C29),
    systemNavigationBarIconBrightness: Brightness.light,
  ));
  runApp(const SmartStoreApp());
}

class SmartStoreApp extends StatelessWidget {
  const SmartStoreApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SmartStore',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F0C29),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF4EDEA3),
          surface: Color(0xFF0F0C29),
        ),
      ),
      home: const SmartStoreWebView(),
    );
  }
}

class SmartStoreWebView extends StatefulWidget {
  const SmartStoreWebView({super.key});

  @override
  State<SmartStoreWebView> createState() => _SmartStoreWebViewState();
}

class _SmartStoreWebViewState extends State<SmartStoreWebView> {
  late final WebViewController _controller;
  late final WebViewWidget _webViewWidget;
  bool _isLoading = true;
  bool _hasError = false;
  int _loadingProgress = 0;
  bool _initialLoadDone = false;

  final String _appUrl = 'https://smartstore-app-eight.vercel.app';

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0F0C29))
      ..setUserAgent('Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 SmartStoreMobile/1.0')
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            setState(() {
              _loadingProgress = progress;
            });
          },
          onPageStarted: (String url) {
            if (!_initialLoadDone) {
              setState(() {
                _isLoading = true;
                _hasError = false;
              });
            }
          },
          onPageFinished: (String url) {
            setState(() {
              _isLoading = false;
              _initialLoadDone = true;
            });
          },
          onWebResourceError: (WebResourceError error) {
            // Only flag fatal error if it's main frame during initial load
            // and not an aborted/cancelled request
            if (error.isForMainFrame == true && !_initialLoadDone) {
              if (error.errorCode != -3 && error.errorCode != -9) {
                setState(() {
                  _isLoading = false;
                  _hasError = true;
                });
              }
            }
          },
          onNavigationRequest: (NavigationRequest request) {
            // Support blob, data, and web URLs
            return NavigationDecision.navigate;
          },
        ),
      );

    // Platform-specific Android enhancements: enable debugging & Hybrid Composition
    if (_controller.platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(true);
      final androidController = _controller.platform as AndroidWebViewController;
      androidController.setMediaPlaybackRequiresUserGesture(false);

      final cookieManager = WebViewCookieManager();
      if (cookieManager.platform is AndroidWebViewCookieManager) {
        (cookieManager.platform as AndroidWebViewCookieManager)
            .setAcceptThirdPartyCookies(androidController, true);
      }
    }

    PlatformWebViewWidgetCreationParams params = PlatformWebViewWidgetCreationParams(
      controller: _controller.platform,
      layoutDirection: TextDirection.ltr,
      gestureRecognizers: const <Factory<OneSequenceGestureRecognizer>>{},
    );

    if (WebViewPlatform.instance is AndroidWebViewPlatform) {
      params = AndroidWebViewWidgetCreationParams.fromPlatformWebViewWidgetCreationParams(
        params,
        displayWithHybridComposition: true,
      );
    }

    _webViewWidget = WebViewWidget.fromPlatformCreationParams(params: params);

    // Always clear cache on cold start so fresh Vercel bundle loads
    _controller.clearCache().then((_) {
      _controller.loadRequest(Uri.parse(_appUrl));
    }).catchError((_) {
      _controller.loadRequest(Uri.parse(_appUrl));
    });
  }

  void _reloadApp() {
    setState(() {
      _hasError = false;
      _isLoading = true;
      _initialLoadDone = false;
      _loadingProgress = 0;
    });
    _controller.clearCache().then((_) {
      _controller.loadRequest(Uri.parse(_appUrl));
    }).catchError((_) {
      _controller.reload();
    });
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, dynamic result) async {
        if (didPop) return;
        if (await _controller.canGoBack()) {
          await _controller.goBack();
        } else {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF0F0C29),
        body: SafeArea(
          child: Stack(
            children: [
              // Main WebView content rendered with native Hybrid Composition
              if (!_hasError)
                _webViewWidget,

              // Subtle Top Loading Progress Indicator (non-blocking after initial load)
              if (_isLoading && _initialLoadDone && _loadingProgress < 100)
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: LinearProgressIndicator(
                    value: _loadingProgress / 100.0,
                    backgroundColor: Colors.transparent,
                    valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF4EDEA3)),
                    minHeight: 2.5,
                  ),
                ),

              // Full Splash on First Launch
              if (_isLoading && !_initialLoadDone && !_hasError)
                Container(
                  color: const Color(0xFF0F0C29),
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF4EDEA3), Color(0xFF00BFA5)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x594EDEA3),
                                blurRadius: 24,
                                offset: Offset(0, 8),
                              ),
                            ],
                          ),
                          child: const Icon(
                            Icons.inventory_2_rounded,
                            size: 42,
                            color: Color(0xFF003822),
                          ),
                        ),
                        const SizedBox(height: 24),
                        const Text(
                          'SmartStore',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            letterSpacing: -0.5,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Smart Inventory & Purchase Manager',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.white54,
                          ),
                        ),
                        const SizedBox(height: 32),
                        const SizedBox(
                          width: 28,
                          height: 28,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Color(0xFF4EDEA3),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              // Connection Error Screen with Retry
              if (_hasError)
                Center(
                  child: Padding(
                    padding: const EdgeInsets.all(28.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 72,
                          height: 72,
                          decoration: const BoxDecoration(
                            color: Color(0x26E5A93C),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.wifi_off_rounded,
                            size: 40,
                            color: Color(0xFFE5A93C),
                          ),
                        ),
                        const SizedBox(height: 20),
                        const Text(
                          'Unable to Connect',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'SmartStore needs an active internet connection to sync inventory and orders.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 14,
                            height: 1.4,
                            color: Colors.white70,
                          ),
                        ),
                        const SizedBox(height: 24),
                        ElevatedButton.icon(
                          onPressed: _reloadApp,
                          icon: const Icon(Icons.refresh_rounded, size: 20),
                          label: const Text(
                            'Try Again',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF4EDEA3),
                            foregroundColor: const Color(0xFF003822),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 28,
                              vertical: 14,
                            ),
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
