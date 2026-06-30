package com.phantombrowser.modules;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import com.phantombrowser.proxy.ProxyBridgeModule;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class PhantomPackage implements ReactPackage {

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext ctx) {
        return Arrays.asList(new ProxyBridgeModule(ctx), new DownloadModule(ctx), new CrashReportModule(ctx));
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext ctx) {
        return Collections.emptyList();
    }
}
