<?php
// A simple test page to verify staging deployment

$environment = "STAGING";
$timestamp = date("Y-m-d H:i:s");

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Editorr - <?php echo $environment; ?> Environment</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
        }
        .environment {
            display: inline-block;
            padding: 5px 10px;
            background-color: #e74c3c;
            color: white;
            border-radius: 3px;
            font-weight: bold;
        }
        .timestamp {
            color: #7f8c8d;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Editorr Deployment Test</h1>
        <p>This page confirms that the deployment to the <span class="environment"><?php echo $environment; ?></span> environment was successful.</p>
        
        <p>This is a test page created to verify that our deployment process is working correctly. If you can see this page, it means:</p>
        
        <ul>
            <li>The code was successfully deployed to the server</li>
            <li>The web server is correctly configured</li>
            <li>The DNS settings are properly set up</li>
        </ul>
        
        <p class="timestamp">Page generated at: <?php echo $timestamp; ?></p>
    </div>
</body>
</html>
