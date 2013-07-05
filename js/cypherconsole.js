/**
 * Licensed to Neo Technology under one or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership. Neo Technology licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You
 * may obtain a copy of the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

'use strict';

var CONSOLE_URL_BASE = 'http://localhost:8080/';
// var CONSOLE_URL_BASE = 'http://console-test.neo4j.org/';
var CONSOLE_AJAX_ENDPOINT = CONSOLE_URL_BASE + 'console/cypher';
var CONSOLE_INIT_ENDPOINT = CONSOLE_URL_BASE + 'console/init';
var $WRAPPER = $( '<div class="query-wrapper" />' );
var $IFRAME = $( '<iframe/>' ).attr( 'id', 'console' ).addClass( 'cypherdoc-console' );
var COLLAPSE_ICON = 'icon-collapse-top';
var EXPAND_ICON = 'icon-expand';
var $TOOGLE_BUTTON = $( '<span class="query-toggle" title="Show/Hide the query."><i class="' + COLLAPSE_ICON
    + ' icon-large"></i></span>' );
var $PLAY_BUTTON = $( '<a class="run-query btn btn-small btn-primary" title="Execute the query." href="#"><i class="icon-play"></i></a>' );
var $QUERY_OK_BUTTON = $( '<a class="query-info btn btn-small btn-success" title="Click to show/hide results">OK <i class="icon-large '
    + EXPAND_ICON + '"></i></a >' );
var $QUERY_ERROR_BUTTON = $( '<a class="query-info btn btn-small btn-danger" title="Click to show/hide results">ERROR <i class="icon-large '
    + COLLAPSE_ICON + '"></i></a >' );
var $QUERY_MESSAGE = $( '<pre/>' ).addClass( 'query-message' );
var $VISUALIZATION = $( '<pre/>' ).addClass( 'visualization' );
var ASCIIDOCTOR_OPTIONS = Opal.hash2( [ 'attributes' ], {
  'attributes' : [ 'notitle!' ]
} );
var DEFAULT_SOURCE = 'neo-intro';
var VALID_GIST = /^[0-9a-f]{5,32}$/;
var console_session = null;
var $content = undefined;

$( document ).ready( function()
{
  $content = $( '#content' );
  renderPage();
} );

function replaceNewlines( str )
{
  return str.replace( /\\n/g, '&#013;' );
}

function executeQueries()
{
  $( 'div.query-wrapper' ).each( function( index, element )
  {
    var $wrapper = $( element );
    $wrapper.data( 'number', index + 1 );
    var statement = $wrapper.data( 'query' );
    execute( statement, function( results )
    {
      var data = JSON.parse( results );
      if ( data.error )
      {
        createQueryResultButton( $QUERY_ERROR_BUTTON, $wrapper, data.error, false );
      }
      else
      {
        createQueryResultButton( $QUERY_OK_BUTTON, $wrapper, data.result, true );

        var viz = data['visualization'];
        $wrapper.data( 'visualization', viz );
        // var graphEl = '.graph' + ( index + 1 );
        // $( graphEl ).each( function( i, el )
        // {
        // d3graph( el, viz );
        // } );

        var resultEl = '.output' + ( index + 1 );
        $( resultEl ).each( function( i, el )
        {
          var result = data.result;
          $( el ).append( '<pre>' + result + '</pre>' );
        } );

        var tableEl = '.resulttable' + ( index + 1 );
        $( tableEl ).each( function( i, el )
        {
          // console.log( data );
          renderResult( el, data );
        } );
      }
    }, function( results )
    {
      console.log( 'Execution error', arguments );
    } );
  } );
}

function createQueryResultButton( $buttonType, $wrapper, message, hide )
{
  var $button = $buttonType.clone();
  $wrapper.after( $button );
  var $message = $QUERY_MESSAGE.clone().text( replaceNewlines( message ) );
  if ( hide )
  {
    $message.hide();
  }
  $button.click( function()
  {
    toggler( $message, $button );
  } );
  $wrapper.after( $message );
}

function toggler( $target, button, action )
{
  var $icon = $( 'i', button );
  var stateIsExpanded = $icon.hasClass( COLLAPSE_ICON );
  if ( ( action && action === 'hide' ) || ( action === undefined && stateIsExpanded ) )
  {
    $target.hide();
    $icon.removeClass( COLLAPSE_ICON ).addClass( EXPAND_ICON );
    return 'hide';
  }
  else
  {
    $target.show();
    $icon.removeClass( EXPAND_ICON ).addClass( COLLAPSE_ICON );
    return 'show';
  }
}

function initConsole()
{
  $.ajax( {
    'type' : 'POST',
    'dataType' : 'json',
    'url' : CONSOLE_INIT_ENDPOINT,
    'data' : JSON.stringify( {
      'init' : 'none',
      'query' : 'none',
      'message' : 'none',
      'no_root' : true
    } ),
    'success' : function( data, textStatus, request )
    {
      // console.log( 'sessionid', data.sessionId );
      if ( !console_session )
      {
        console_session = data.sessionId; // 83478239;
        // console.log( console_session );
      }
      // console.log( data );
      executeQueries();
      createCypherConsole();
      renderGraphs();
    },
    'error' : console.log,
    'async' : true
  } );
}

function execute( statement, callback, error, endpoint )
{
  var url = ( endpoint || CONSOLE_AJAX_ENDPOINT );// + ';jsessionid=' + console_session;
  // console.log( 'calling', url );
  $.ajax( {
    'type' : 'POST',
    'headers' : {},
    'url' : url,
    'data' : statement,
    'success' : callback,
    'error' : error,
    'async' : false
  } );
}

function renderGraphs()
{
  findPreviousQueryWrapper( 'h5.graph-visualization', $content, function( $heading, $wrapper )
  {
    var visualization = $wrapper.data( 'visualization' );
    $heading.text( 'The graph after query ' + $wrapper.data( 'number' ) );
    var $visContainer = $VISUALIZATION.clone().appendTo( $heading );
    if ( visualization )
    {
      d3graph( $visContainer[0], visualization );
    }
    else
    {
      $visContainer.text( 'There is no graph to render.' ).addClass( 'alert-error' );
    }
  } );
}

function preProcessContents( content )
{
  var sanitized = content.replace( /^\/\/\s*?console/m, '++++\n<p class="console"></p>\n++++\n' );
  sanitized = sanitized.replace( /^\/\/\s*?hide/gm, '++++\n<span class="hide-query"></span>\n++++\n' );
  sanitized = sanitized.replace( /^\/\/\s*?setup/m, '++++\n<span id="setup-query"></span>\n++++\n' );
  sanitized = sanitized.replace( /^\/\/\s*?graph.*/gm, '++++\n<h5 class="graph-visualization"></h5>\n++++\n' );
  sanitized = sanitized.replace( /^\/\/\W*table(.*)/gm, function( match, name )
  {
    return '++++\n<h5>Results from Query ' + name + '</h5><div class="resulttable' + name + '"></div>\n++++\n';
  } );
  sanitized = sanitized.replace( /^\/\/\W*output(.*)/gm, function( match, name )
  {
    return '++++\n<h5>Raw output from Query ' + name + '</h5><div class="output' + name + '"></div>\n++++\n';
  } );
  return sanitized;
}

function findQuery( selector, context, operation )
{
  $( selector, context ).each(
      function()
      {
        $( this ).nextAll( 'div.listingblock' ).children( 'div' ).children( 'pre.highlight' ).children( 'code.cypher' )
            .first().each( function()
            {
              operation( this );
            } );
      } );
}

function findPreviousQueryWrapper( selector, context, operation )
{
  $( selector, context ).each(
      function()
      {
        var $selected = $( this );
        $selected.prevAll( 'div.listingblock' ).children( 'div' ).children( 'pre.highlight' ).children(
            'div.query-wrapper' ).first().each( function()
        {
          operation( $selected, $( this ) );
        } );
      } );
}

function fetchGithubGist( gist, success, error )
{
  if ( !VALID_GIST.test( gist ) )
  {
    error( 'The gist id is malformed: ' + gist );
    return;
  }

  var url = 'https://api.github.com/gists/' + gist;
  $.ajax( {
    'url' : url,
    'success' : function( data )
    {
      var file = data.files[Object.keys( data.files )[0]];
      var content = file.content;
      var link = data.html_url;
      success( content, link );
    },
    'dataType' : 'json',
    'error' : function( xhr, status, errorMessage )
    {
      error( errorMessage );
    }
  } );
}

function fetchLocalSnippet( id, success, error )
{
  var url = './gists/' + id + '.adoc';
  $.ajax( {
    'url' : url,
    'success' : function( data )
    {
      var link = 'https://github.com/neo4j-contrib/graphgist/tree/master/gists/' + id + '.adoc';
      success( data, link );
    },
    'dataType' : 'text',
    'error' : function( xhr, status, errorMessage )
    {
      error( errorMessage );
    }
  } );
}

function renderContent( originalContent, link )
{
  $( '#gist_link' ).attr( 'href', link );
  var doc = preProcessContents( originalContent );
  $content.empty();
  var generatedHtml = undefined;
  try
  {
    generatedHtml = Opal.Asciidoctor.$render( doc, ASCIIDOCTOR_OPTIONS );
  }
  catch ( e )
  {
    errorMessage( e.name + ':' + '<p>' + e.message + '</p>' );
    return;
  }
  $content.html( generatedHtml );
  postProcessPage();
  initConsole();
}

function renderPage()
{
  var id = window.location.search;
  if ( id.length < 2 )
  {
    id = DEFAULT_SOURCE;
  }
  else
  {
    id = id.substr( 1 );
  }
  var fetcher = fetchGithubGist;
  if ( id.length > 4 && id.substr( 0, 4 ) === 'neo-' )
  {
    fetcher = fetchLocalSnippet;
    id = id.substr( 4 );
  }
  fetcher( id, renderContent, function( message )
  {
    errorMessage( message, id );
  } );
}

function postProcessPage()
{
  findQuery( 'span.hide-query', $content, function( codeElement )
  {
    $( codeElement.parentNode ).addClass( 'hide-query' );
  } );
  findQuery( '#setup-query', $content, function( codeElement )
  {
    $( codeElement.parentNode ).addClass( 'setup-query' );
  } );
  $( 'code.cypher', $content ).each( function( index, el )
  {
    var number = ( index + 1 );
    var $el = $( el );
    $el.attr( 'class', 'brush: cypher' );
    var $parent = $el.parent();
    $parent.prepend( '<h5>Query ' + number + '</h5>' );
    $el.wrap( $WRAPPER ).each( function()
    {
      $el.parent().data( 'query', $el.text() );
    } );
    var $toggleQuery = $TOOGLE_BUTTON.clone();
    $parent.append( $toggleQuery );
    $toggleQuery.click( function()
    {
      var $icon = $( 'i', this );
      var $queryWrapper = $icon.parent().prevAll( 'div.query-wrapper' ).first();
      var action = toggler( $queryWrapper, this );
      if ( action === 'hide' )
      {
        var $queryMessage = $queryWrapper.nextAll( 'pre.query-message' ).first();
        var $icon = $queryWrapper.nextAll( 'a.query-info' ).first();
        toggler( $queryMessage, $icon, 'hide' );
      }
    } );
    if ( $parent.hasClass( 'hide-query' ) )
    {
      var $wrapper = $toggleQuery.prevAll( 'div.query-wrapper' ).first();
      toggler( $wrapper, $toggleQuery, 'hide' );
    }
  } );
  SyntaxHighlighter.config['tagName'] = 'code';
  SyntaxHighlighter.defaults['tab-size'] = 4;
  SyntaxHighlighter.defaults['gutter'] = false;
  SyntaxHighlighter.defaults['toolbar'] = false;
  SyntaxHighlighter.highlight();
}

function d3graph( element, graph )
{
  var svg = d3.select( element ).append( 'svg' );
  var width = 500, height = 200;
  svg.attr( 'width', width ).attr( 'height', height );
  var color = d3.scale.category20();

  var force = d3.layout.force().charge( -120 ).linkDistance( 10 ).size( [ width, height ] );
  force.nodes( graph.nodes ).links( graph.links ).start();

  var link = svg.selectAll( '.link' ).data( graph.links ).enter().append( 'line' ).attr( 'class', 'link' ).style(
      'stroke-width', function( d )
      {
        return Math.sqrt( d.value );
      } );

  var node = svg.selectAll( '.node' ).data( graph.nodes ).enter().append( 'circle' ).attr( 'class', 'node' ).attr( 'r',
      5 ).style( 'fill', function( d )
  {
    return color( d.group );
  } ).call( force.drag );

  node.append( 'title' ).text( function( d )
  {
    return d.name;
  } );

  force.on( 'tick', function()
  {
    link.attr( 'x1', function( d )
    {
      return d.source.x;
    } ).attr( 'y1', function( d )
    {
      return d.source.y;
    } ).attr( 'x2', function( d )
    {
      return d.target.x;
    } ).attr( 'y2', function( d )
    {
      return d.target.y;
    } );

    node.attr( 'cx', function( d )
    {
      return d.x;
    } ).attr( 'cy', function( d )
    {
      return d.y;
    } );
  } );
}

function createCypherConsole()
{
  $( 'p.console' ).first().each( function()
  {
    var context = $( this );
    var url = getUrl( 'none', 'none', '\n\nClick the play buttons to run the queries!', console_session );
    var iframe = $IFRAME.clone().attr( 'src', url );
    iframe.load( function()
    {
      $( '#content pre.highlight.setup-query' ).first().children( 'div.query-wrapper' ).first().each( function()
      {
        var query = $( this ).data( 'query' );
        if ( query )
        {
          executeInConsole( query );
        }
      } );
    } );
    context.append( iframe );
    context.height( iframe.height() );
    $( 'div.query-wrapper' ).parent().append( $PLAY_BUTTON.clone().click( function( event )
    {
      event.preventDefault();
      var query = $( this ).prevAll( 'div.query-wrapper' ).first().data( 'query' );
      executeInConsole( query );
    } ) );
    var offset = iframe.offset();
    if ( offset && offset.top )
    {
      var limit = offset.top;
      var $window = $( window );
      $window.scroll( function()
      {
        if ( $window.scrollTop() > limit )
        {
          iframe.css( 'position', 'fixed' );
        }
        else
        {
          iframe.css( 'position', 'static' );
        }
      } );
    }
  } );

  function executeInConsole( query )
  {
    $( '#console' )[0].contentWindow.postMessage( query, '*' );
  }

  function getUrl( database, command, message, session )
  {
    var url = CONSOLE_URL_BASE;

    if ( session !== undefined )
    {
      url += ';jsessionid=' + session;
    }
    url += '?';
    if ( database !== undefined )
    {
      url += 'init=' + encodeURIComponent( database );
    }
    if ( command !== undefined )
    {
      url += '&query=' + encodeURIComponent( command );
    }
    if ( message !== undefined )
    {
      url += '&message=' + encodeURIComponent( message );
    }
    if ( window.neo4jVersion != undefined )
    {
      url += '&version=' + encodeURIComponent( neo4jVersion );
    }
    return url + '&no_root=true';
  }
}

function errorMessage( message, gist )
{
  var messageText;
  if ( gist )
  {
    messageText = 'Somethng went wrong fetching the gist "' + gist + '":<p>' + message + '</p>';
  }
  else
  {
    messageText = '<p>' + message + '</p>';
  }

  $content.html( '<div class="alert alert-block alert-error"><h4>Error</h4>' + messageText + '</div>' );
}
