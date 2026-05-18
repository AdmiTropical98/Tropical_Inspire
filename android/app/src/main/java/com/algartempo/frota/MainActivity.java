package com.algartempo.frota;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, true);
        window.setStatusBarColor(Color.parseColor("#0B2239"));
        window.setNavigationBarColor(Color.parseColor("#0B2239"));
        window.setBackgroundDrawableResource(android.R.color.white);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams layoutParams = window.getAttributes();
            layoutParams.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_NEVER;
            window.setAttributes(layoutParams);
        }

        final View decorView = window.getDecorView();
        final WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window, decorView);
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(false);
            insetsController.setAppearanceLightNavigationBars(false);
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setBackgroundColor(Color.WHITE);
            getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
            getBridge().getWebView().setVerticalScrollBarEnabled(false);
            getBridge().getWebView().setHorizontalScrollBarEnabled(false);
        }
    }
}
