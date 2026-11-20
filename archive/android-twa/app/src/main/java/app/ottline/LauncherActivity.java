/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package app.ottline;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.TextUtils;



public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    static final String EXTRA_QUICK_TYPE = "quick_type";
    static final String QUICK_TYPE_RECORD = "record";
    static final String QUICK_TYPE_VIDEO = "video";
    static final String QUICK_TYPE_BOOK = "book";
    static final String QUICK_TYPE_TIMELINE = "timeline";
    static final String EXTRA_REVISIT_DELIVERY_ID = "revisit_delivery_id";


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Setting an orientation crashes the app due to the transparent background on Android 8.0
        // Oreo and below. We only set the orientation on Oreo and above. This only affects the
        // splash screen and Chrome will still respect the orientation.
        // See https://github.com/GoogleChromeLabs/bubblewrap/issues/496 for details.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();
        Intent intent = getIntent();
        if (intent == null) return withAndroidLaunchContext(uri);
        markRevisitReminderOpened(intent);

        Uri data = intent.getData();
        if (isOttlineUrl(data)) {
            return withAndroidLaunchContext(data);
        }

        String quickType = intent.getStringExtra(EXTRA_QUICK_TYPE);
        if (!TextUtils.isEmpty(quickType)) {
            if (QUICK_TYPE_TIMELINE.equals(quickType)) {
                return withAndroidLaunchContext(uri.buildUpon().path("/timeline").build());
            }
            if (QUICK_TYPE_RECORD.equals(quickType)) {
                return withAndroidLaunchContext(uri.buildUpon()
                        .appendQueryParameter("quick", "1")
                        .appendQueryParameter("quick_focus", "1")
                        .build());
            }
            if (QUICK_TYPE_VIDEO.equals(quickType) || QUICK_TYPE_BOOK.equals(quickType)) {
                return withAndroidLaunchContext(uri.buildUpon()
                        .appendQueryParameter("quick", "1")
                        .appendQueryParameter("quick_type", quickType)
                        .appendQueryParameter("quick_focus", "1")
                        .build());
            }
        }

        String action = intent.getAction();
        if (Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            String sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            String sharedMime = intent.getType();

            if (sharedText != null && !sharedText.isBlank()) {
                Uri.Builder builder = uri.buildUpon();
                builder.appendQueryParameter("shared_text", sharedText);
                if (sharedSubject != null && !sharedSubject.isBlank()) {
                    builder.appendQueryParameter("shared_subject", sharedSubject);
                }
                if (sharedMime != null && !sharedMime.isBlank()) {
                    builder.appendQueryParameter("shared_mime", sharedMime);
                }
                return withAndroidLaunchContext(builder.build());
            }
        }

        return withAndroidLaunchContext(uri);
    }

    private void markRevisitReminderOpened(Intent intent) {
        String deliveryId = intent.getStringExtra(EXTRA_REVISIT_DELIVERY_ID);
        if (TextUtils.isEmpty(deliveryId)) return;

        intent.removeExtra(EXTRA_REVISIT_DELIVERY_ID);
        Context appContext = getApplicationContext();
        new Thread(() -> {
            try {
                RevisitReminderApiClient.markOpened(appContext, deliveryId);
            } catch (Throwable ignored) {
            }
        }).start();
    }

    private boolean isOttlineUrl(Uri uri) {
        return uri != null
                && "https".equals(uri.getScheme())
                && "ottline.app".equals(uri.getHost());
    }

    private Uri withAndroidLaunchContext(Uri uri) {
        if (uri == null || !isOttlineUrl(uri)) return uri;

        Uri.Builder builder = uri.buildUpon();
        boolean changed = false;
        if (TextUtils.isEmpty(uri.getQueryParameter("android_app_version"))) {
            builder.appendQueryParameter("android_app_version", BuildConfig.VERSION_NAME);
            changed = true;
        }
        if (TextUtils.isEmpty(uri.getQueryParameter("android_app_version_code"))) {
            builder.appendQueryParameter("android_app_version_code", String.valueOf(BuildConfig.VERSION_CODE));
            changed = true;
        }
        if (TextUtils.isEmpty(uri.getQueryParameter("android_install_token"))) {
            builder.appendQueryParameter("android_install_token", AndroidInstallToken.get(this));
            changed = true;
        }
        return changed ? builder.build() : uri;
    }
}
