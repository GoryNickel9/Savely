package cc.savely.android;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/** Routes icon taps and verified App Links to the private browser launcher. */
public final class AppEntryActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        openSite(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        openSite(intent);
    }

    private void openSite(Intent incoming) {
        String candidate = incoming.getDataString();
        String launchUrl = LaunchUrlPolicy.resolve(candidate, Intent.ACTION_VIEW.equals(incoming.getAction()));
        Intent browserLauncher = new Intent(this, SavelyTwaActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .setData(Uri.parse(launchUrl))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        // Do not forward extras, grants or a caller-selected component/package to the browser.
        startActivity(browserLauncher);
        finish();
    }
}
