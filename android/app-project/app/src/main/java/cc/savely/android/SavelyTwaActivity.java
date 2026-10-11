package cc.savely.android;

import android.net.Uri;

import com.google.androidbrowserhelper.trusted.LauncherActivity;
import com.google.androidbrowserhelper.trusted.TwaLauncher;

/** Uses the browser's cookie/storage session and serves the existing website without a WebView. */
public final class SavelyTwaActivity extends LauncherActivity {
    @Override
    protected TwaLauncher createTwaLauncher() {
        // A session tied to the transient launcher task would open another browser document per tap.
        return new TwaLauncher(this);
    }

    @Override
    protected Uri getLaunchingUrl() {
        String candidate = getIntent().getDataString();
        // Repeat validation at the native boundary. Do not call the helper's default method:
        // it logs incoming URLs, which may contain account recovery credentials.
        return Uri.parse(LaunchUrlPolicy.resolve(candidate, true));
    }
}
