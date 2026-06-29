package com.phantombrowser;

import android.os.Bundle;
import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;

public class MainActivity extends ReactActivity {

    @Override
    protected String getMainComponentName() {
        return "PhantomBrowser";
    }

    /**
     * Required for react-native-screens + react-native-gesture-handler on Android.
     * Without this, screen transitions may flicker or gestures won't work.
     */
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(null); // pass null to avoid state restoration issues with react-native-screens
    }

    @Override
    protected ReactActivityDelegate createReactActivityDelegate() {
        return new DefaultReactActivityDelegate(
            this,
            getMainComponentName(),
            DefaultNewArchitectureEntryPoint.getFabricEnabled()
        );
    }
}
